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
const { verifyAndConsumeTotp } = require("../_lib/totp");

const scrypt = promisify(crypto.scrypt);

const MAX_ATTEMPTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 900;
const MAX_PASSWORD_LENGTH = 512;

function send(res, status, data) {
  return res.status(status).json(data);
}

function parseScryptHash(value) {
  if (typeof value !== "string") return null;

  const parts = value.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);

  if (
    !Number.isInteger(N) ||
    N < 2 ** 14 ||
    N > 2 ** 16 ||
    (N & (N - 1)) !== 0 ||
    !Number.isInteger(r) ||
    r < 8 ||
    r > 16 ||
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

  const salt = Buffer.from(parts[4], "base64url");
  const hash = Buffer.from(parts[5], "base64url");

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

  return { N, r, p, salt, hash };
}

function getPasswordConfig() {
  const value = process.env.ADMIN_PASSWORD_HASH;

  if (typeof value !== "string" || value.trim() === "") {
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
      maxmem: 128 * config.N * config.r * 2 + 1024 * 1024
    }
  );

  return (
    derived.length === config.hash.length &&
    crypto.timingSafeEqual(derived, config.hash)
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!checkSameOrigin(req)) {
    return send(res, 403, { error: "Forbidden origin." });
  }

  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.getPrototypeOf(body) !== Object.prototype ||
    Object.keys(body).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(body, "password") ||
    !Object.prototype.hasOwnProperty.call(body, "totpCode") ||
    typeof body.password !== "string" ||
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(body.password, "utf8") > 2048 ||
    typeof body.totpCode !== "string" ||
    !/^\d{6}$/.test(body.totpCode)
  ) {
    return send(res, 400, { error: "Invalid request." });
  }

  let passwordConfig;

  try {
    passwordConfig = getPasswordConfig();
  } catch {
    console.error("[admin-login] Authentication configuration error.");

    return send(res, 503, {
      error: "Admin authentication is not configured."
    });
  }

  const clientKey = getClientKey(req);

  if (!clientKey) {
    return send(res, 503, {
      error: "Unable to verify client address."
    });
  }

  const ipKey = `mash:admin-login:${clientKey}`;

  try {
    const result = await consume(
      ipKey,
      IP_WINDOW_SECONDS,
      MAX_ATTEMPTS_PER_IP
    );

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));

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

  let validPassword;

  try {
    validPassword = await verifyPassword(
      body.password,
      passwordConfig
    );
  } catch {
    console.error("[admin-login] Password verification failed.");

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  if (!validPassword) {
    return send(res, 401, {
      error: "Invalid password or authentication code."
    });
  }

  let validTotp;

  try {
    validTotp = await verifyAndConsumeTotp(body.totpCode);
  } catch {
    console.error("[admin-login] MFA verification service unavailable.");

    return send(res, 503, {
      error: "MFA service is not configured or temporarily unavailable."
    });
  }

  if (!validTotp) {
    return send(res, 401, {
      error: "Invalid password or authentication code."
    });
  }

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
