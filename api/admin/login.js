"use strict";

const crypto = require("crypto");
const { promisify } = require("util");

const {
  createSession,
  setSessionCookie,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { getClientKey } = require("../_lib/client-ip");
const { hit, peek, reset } = require("../_lib/rate-limit");

const scrypt = promisify(crypto.scrypt);

const MAX_ATTEMPTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 900;

// Failed attempts across ALL addresses (stops botnets / IP rotation).
// Override with ADMIN_LOGIN_GLOBAL_LIMIT in Vercel env.
const GLOBAL_WINDOW_SECONDS = 3600;
const DEFAULT_GLOBAL_LIMIT = 100;

const MAX_PASSWORD_LENGTH = 512;

const GLOBAL_KEY = "mash:admin-login:global-failures";

function send(res, status, data) {
  return res.status(status).json(data);
}

function getGlobalLimit() {
  const value = Number(process.env.ADMIN_LOGIN_GLOBAL_LIMIT);

  return Number.isSafeInteger(value) && value >= 10 && value <= 10000
    ? value
    : DEFAULT_GLOBAL_LIMIT;
}

/* ---------- password verification ---------- */

function safeCompare(a, b) {
  const first = crypto.createHash("sha256").update(a, "utf8").digest();
  const second = crypto.createHash("sha256").update(b, "utf8").digest();

  return crypto.timingSafeEqual(first, second);
}

// Format: scrypt$N$r$p$<salt base64url>$<hash base64url>
// Generate with: node tools/hash-password.js
function parseScryptHash(value) {
  const parts = value.split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

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

  if (!Number.isInteger(r) || r < 8 || r > 16) return null;
  if (!Number.isInteger(p) || p < 1 || p > 4) return null;

  const salt = Buffer.from(parts[4], "base64url");
  const hash = Buffer.from(parts[5], "base64url");

  if (salt.length < 16 || hash.length < 32 || hash.length > 128) {
    return null;
  }

  return { N, r, p, salt, hash };
}

// Prefers ADMIN_PASSWORD_HASH. Falls back to ADMIN_PASSWORD so nothing
// breaks until you switch. Misconfiguration throws (fails closed).
function getPasswordConfig() {
  const hashEnv = process.env.ADMIN_PASSWORD_HASH;

  if (typeof hashEnv === "string" && hashEnv.trim() !== "") {
    const parsed = parseScryptHash(hashEnv.trim());

    if (!parsed) {
      throw new Error("ADMIN_PASSWORD_HASH is invalid.");
    }

    return { type: "scrypt", ...parsed };
  }

  const plain = process.env.ADMIN_PASSWORD;

  if (typeof plain === "string" && plain.length > 0) {
    return { type: "plain", plain };
  }

  throw new Error("Admin password is not configured.");
}

async function verifyPassword(input, config) {
  if (config.type === "plain") {
    return safeCompare(input, config.plain);
  }

  const derived = await scrypt(input, config.salt, config.hash.length, {
    N: config.N,
    r: config.r,
    p: config.p,
    maxmem: 128 * config.N * config.r * 2 + 1024 * 1024
  });

  return (
    derived.length === config.hash.length &&
    crypto.timingSafeEqual(derived, config.hash)
  );
}

/* ---------- handler ---------- */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

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
    Object.keys(body).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(body, "password") ||
    typeof body.password !== "string" ||
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(body.password, "utf8") > 2048
  ) {
    return send(res, 400, { error: "Invalid request." });
  }

  let passwordConfig;

  try {
    passwordConfig = getPasswordConfig();
  } catch (error) {
    console.error("Admin auth config error:", error.message);

    return send(res, 503, {
      error: "Admin authentication is not configured."
    });
  }

  const ipKey = `mash:admin-login:${getClientKey(req)}`;

  // Rate limits run BEFORE the password is checked.
  try {
    const attempts = await hit(ipKey, IP_WINDOW_SECONDS);

    if (attempts > MAX_ATTEMPTS_PER_IP) {
      res.setHeader("Retry-After", String(IP_WINDOW_SECONDS));

      return send(res, 429, {
        error: "Too many login attempts. Try again later."
      });
    }

    const globalFailures = await peek(GLOBAL_KEY);

    if (globalFailures >= getGlobalLimit()) {
      res.setHeader("Retry-After", String(GLOBAL_WINDOW_SECONDS));

      return send(res, 429, {
        error: "Too many login attempts. Try again later."
      });
    }
  } catch (error) {
    console.error("Admin rate limit error:", error.message);

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  let valid = false;

  try {
    valid = await verifyPassword(body.password, passwordConfig);
  } catch (error) {
    console.error("Admin password check error:", error.message);

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  if (!valid) {
    try {
      await hit(GLOBAL_KEY, GLOBAL_WINDOW_SECONDS);
    } catch (error) {
      console.error("Admin global counter error:", error.message);
    }

    return send(res, 401, { error: "Incorrect password." });
  }

  // Successful login: don't let earlier typos lock the owner out.
  try {
    await reset(ipKey);
  } catch (error) {
    console.error("Admin counter reset error:", error.message);
  }

  try {
    setSessionCookie(res, createSession());

    return send(res, 200, { success: true });
  } catch (error) {
    console.error("Admin session error:", error.message);

    return send(res, 503, {
      error: "Could not create admin session."
    });
  }
};
