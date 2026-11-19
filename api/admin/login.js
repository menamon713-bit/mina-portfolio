"use strict";

const crypto = require("crypto");
const {
  createSession,
  setSessionCookie,
  checkSameOrigin
} = require("../_lib/admin-auth");

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900;

function send(res, status, data) {
  return res.status(status).json(data);
}

function safeCompare(a, b) {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return crypto.timingSafeEqual(first, second);
}

function getIP(req) {
  const value = req.headers["x-forwarded-for"];

  if (typeof value === "string" && value.length) {
    return value.split(",")[0].trim().slice(0, 100);
  }

  return "unknown";
}

async function checkLoginLimit(ip) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("RATE_LIMIT_CONFIG_MISSING");
  }

  const key = `mash:admin-login:${ip}`;

  const script = `
    local count = redis.call("INCR", KEYS[1])
    if count == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end
    return count
  `;

  const response = await fetch(url, {
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
    ])
  });

  if (!response.ok) {
    throw new Error("RATE_LIMIT_SERVICE_ERROR");
  }

  const result = await response.json();
  const count = Number(result.result);

  if (result.error || !Number.isSafeInteger(count)) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return count <= MAX_ATTEMPTS;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!checkSameOrigin(req)) {
    return send(res, 403, { error: "Forbidden origin." });
  }

  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    typeof req.body.password !== "string" ||
    req.body.password.length > 512
  ) {
    return send(res, 400, { error: "Invalid request." });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return send(res, 503, {
      error: "Admin authentication is not configured."
    });
  }

  try {
    const allowed = await checkLoginLimit(getIP(req));

    if (!allowed) {
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

  if (!safeCompare(req.body.password, adminPassword)) {
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
    console.error("Admin session error:", error.message);

    return send(res, 503, {
      error: "Could not create admin session."
    });
  }
};
