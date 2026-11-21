"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const {
  createSession,
  setSessionCookie,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { getClientKey } = require("../_lib/client-ip");
const { consume, reset } = require("../_lib/rate-limit");

const scrypt = promisify(crypto.scrypt);

const MAX_ATTEMPTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 900;

const GLOBAL_WINDOW_SECONDS = 3600;
const DEFAULT_GLOBAL_LIMIT = 100;

const MAX_PASSWORD_LENGTH = 512;

const GLOBAL_KEY = "mash:admin-login:global-attempts:v2";

function send(res, status, data) {
  return res.status(status).json(data);
}

function getGlobalLimit() {
  const value = process.env.ADMIN_LOGIN_GLOBAL_LIMIT;

  if (value === undefined || value === "") {
    return DEFAULT_GLOBAL_LIMIT;
  }

  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value)
  ) {
    throw new Error("ADMIN_LOGIN_GLOBAL_LIMIT is invalid.");
  }

  const limit = Number(value);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 10 ||
    limit > 10000
  ) {
    throw new Error("ADMIN_LOGIN_GLOBAL_LIMIT is invalid.");
  }

  return limit;
}

/* ---------- password verification ---------- */

// Format:
// scrypt$N$r$p$salt_base64url$hash_base64url

function parseScryptHash(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parts = value.split("$");

  if (
    parts.length !== 6 ||
    parts[0] !== "scrypt"
  ) {
    return null;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  if (
    !Number.isInteger(N) ||
    N < 2 ** 14 ||
    N > 2 ** 16 ||
    (N & (N - 1)) !== 0
  ) {
    return null;
  }

  if (
    !Number.isInteger(r) ||
    r < 8 ||
    r > 16
  ) {
    return null;
  }

  if (
    !Number.isInteger(p) ||
    p < 1 ||
    p > 4
  ) {
    return null;
  }

  if (
    !/^[A-Za-z0-9_-]+$/.test(parts[4]) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[5])
  ) {
    return null;
  }

  const salt = Buffer.from(
    parts[4],
    "base64url"
  );

  const hash = Buffer.from(
    parts[5],
    "base64url"
  );

  if (
    salt.toString("base64url") !== parts[4] ||
    hash.toString("base64url") !== parts[5] ||
    salt.length < 16 ||
    salt.length > 64 ||
    hash.length < 32 ||
    hash.length > 128
  ) {
    return null;
  }

  return {
    N,
    r,
    p,
    salt,
    hash
  };
}

function getPasswordConfig() {
  const value = process.env.ADMIN_PASSWORD_HASH;

  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error("ADMIN_PASSWORD_HASH is missing.");
  }

  const parsed = parseScryptHash(value.trim());

  if (!parsed) {
    throw new Error("ADMIN_PASSWORD_HASH is invalid.");
  }

  return parsed;
}

async function verifyPassword(input, config) {
  const derived = await scrypt(
    input,
    config.salt,
    config.hash.length,
    {
      N: config.N,
      r: config.r,
      p: config.p,
      maxmem:
        128 * config.N * config.r * 2 +
        1024 * 1024
    }
  );

  return (
    derived.length === config.hash.length &&
    crypto.timingSafeEqual(
      derived,
      config.hash
    )
  );
}

/* ---------- handler ---------- */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, {
      error: "Method not allowed."
    });
  }

  if (!checkSameOrigin(req)) {
    return send(res, 403, {
      error: "Forbidden origin."
    });
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype ||
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(
      body,
      "password"
    ) ||
    typeof body.password !== "string" ||
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(body.password, "utf8") > 2048
  ) {
    return send(res, 400, {
      error: "Invalid request."
    });
  }

  let passwordConfig;
  let globalLimit;

  try {
    passwordConfig = getPasswordConfig();
    globalLimit = getGlobalLimit();
  } catch {
    console.error("[admin-login] Invalid authentication configuration.");

    return send(res, 503, {
      error: "Admin authentication is not configured."
    });
  }

  const clientKey = getClientKey(req);

  // Never put unknown IPs into a shared rate-limit bucket.
  if (!clientKey) {
    return send(res, 503, {
      error: "Unable to verify client address."
    });
  }

  const ipKey = `mash:admin-login:${clientKey}`;

  // Both limits use atomic Redis operations.
  // IP limit is checked first to avoid unnecessary global consumption.
  try {
    const ipResult = await consume(
      ipKey,
      IP_WINDOW_SECONDS,
      MAX_ATTEMPTS_PER_IP
    );

    if (!ipResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(ipResult.retryAfter)
      );

      return send(res, 429, {
        error: "Too many login attempts. Try again later."
      });
    }

    const globalResult = await consume(
      GLOBAL_KEY,
      GLOBAL_WINDOW_SECONDS,
      globalLimit
    );

    if (!globalResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(globalResult.retryAfter)
      );

      return send(res, 429, {
        error: "Too many login attempts. Try again later."
      });
    }
  } catch {
    console.error("[admin-login] Rate limit service unavailable.");

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  let valid;

  try {
    valid = await verifyPassword(
      body.password,
      passwordConfig
    );
  } catch {
    console.error("[admin-login] Password verification failed.");

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  if (!valid) {
    return send(res, 401, {
      error: "Incorrect password."
    });
  }

  // Reset the per-IP counter after successful authentication.
  // The global counter is intentionally not reset.
  try {
    await reset(ipKey);
  } catch {
    console.error("[admin-login] IP counter reset failed.");
  }

  try {
    const token = createSession();

    setSessionCookie(res, token);

    return send(res, 200, {
      success: true
    });
  } catch {
    console.error("[admin-login] Session creation failed.");

    return send(res, 503, {
      error: "Could not create admin session."
    });
  }
};
