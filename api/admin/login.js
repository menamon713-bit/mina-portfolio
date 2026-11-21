"use strict";

const crypto = require("crypto");
const net = require("net");

const {
  createSession,
  setSessionCookie,
  checkSameOrigin
} = require("../_lib/admin-auth");

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900;
const REDIS_TIMEOUT_MS = 5000;
const MAX_PASSWORD_LENGTH = 512;

function send(res, status, data) {
  return res.status(status).json(data);
}

function safeCompare(a, b) {
  const first = crypto
    .createHash("sha256")
    .update(a, "utf8")
    .digest();

  const second = crypto
    .createHash("sha256")
    .update(b, "utf8")
    .digest();

  return crypto.timingSafeEqual(first, second);
}

function getIP(req) {
  const value = req.headers["x-forwarded-for"];

  if (typeof value !== "string" || value.length > 1024) {
    return "unknown";
  }

  const ip = value.split(",")[0].trim();

  if (!ip || net.isIP(ip) === 0) {
    return "unknown";
  }

  return ip;
}

async function checkLoginLimit(ip) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (
    typeof url !== "string" ||
    typeof token !== "string" ||
    !url ||
    !token
  ) {
    throw new Error("RATE_LIMIT_CONFIG_MISSING");
  }

  let redisURL;

  try {
    redisURL = new URL(url);
  } catch {
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  }

  if (
    redisURL.protocol !== "https:" ||
    redisURL.username ||
    redisURL.password
  ) {
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  }

  const key = `mash:admin-login:${ip}`;

  const script = `
    local count = redis.call("INCR", KEYS[1])
    if count == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end
    return count
  `;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REDIS_TIMEOUT_MS
  );

  try {
    const response = await fetch(redisURL.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        "EVAL",
        script,
        "1",
        key,
        String(WINDOW_SECONDS)
      ]),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("RATE_LIMIT_SERVICE_ERROR");
    }

    const result = await response.json();

    if (
      !result ||
      typeof result !== "object" ||
      result.error
    ) {
      throw new Error("RATE_LIMIT_INVALID_RESPONSE");
    }

    const count = Number(result.result);

    if (
      !Number.isSafeInteger(count) ||
      count < 1
    ) {
      throw new Error("RATE_LIMIT_INVALID_RESPONSE");
    }

    return count <= MAX_ATTEMPTS;

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("RATE_LIMIT_TIMEOUT");
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

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
    !Object.prototype.hasOwnProperty.call(body, "password") ||
    typeof body.password !== "string" ||
    body.password.length === 0 ||
    body.password.length > MAX_PASSWORD_LENGTH ||
    Buffer.byteLength(body.password, "utf8") > 2048
  ) {
    return send(res, 400, {
      error: "Invalid request."
    });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (
    typeof adminPassword !== "string" ||
    adminPassword.length === 0
  ) {
    return send(res, 503, {
      error: "Admin authentication is not configured."
    });
  }

  try {
    const ip = getIP(req);
    const allowed = await checkLoginLimit(ip);

    if (!allowed) {
      return send(res, 429, {
        error: "Too many login attempts. Try again later."
      });
    }

  } catch (error) {
    console.error(
      "Admin rate limit error:",
      error.message
    );

    return send(res, 503, {
      error: "Login service temporarily unavailable."
    });
  }

  if (!safeCompare(body.password, adminPassword)) {
    return send(res, 401, {
      error: "Incorrect password."
    });
  }

  try {
    const session = createSession();

    setSessionCookie(res, session);

    return send(res, 200, {
      success: true
    });

  } catch (error) {
    console.error(
      "Admin session error:",
      error.message
    );

    return send(res, 503, {
      error: "Could not create admin session."
    });
  }
};
