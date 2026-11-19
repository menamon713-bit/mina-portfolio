"use strict";

const { neon } = require("@neondatabase/serverless");

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 600;
const MAX_BODY_BYTES = 12 * 1024;

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000
};

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length) {
    const ip = forwarded.split(",")[0].trim();

    if (ip.length <= 100 && /^[0-9a-fA-F.:]+$/.test(ip)) {
      return ip;
    }
  }

  const realIP = req.headers["x-real-ip"];

  if (typeof realIP === "string" && realIP.length) {
    const ip = realIP.trim();

    if (ip.length <= 100 && /^[0-9a-fA-F.:]+$/.test(ip)) {
      return ip;
    }
  }

  return "unknown";
}

function validateBody(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return "Invalid request body.";
  }

  if (
    body.website !== undefined &&
    typeof body.website !== "string"
  ) {
    return "Invalid submission.";
  }

  // Honeypot protection.
  if (body.website && body.website.trim()) {
    return "Invalid submission.";
  }

  const fields = ["name", "email", "subject", "message"];

  for (const field of fields) {
    if (
      body[field] !== undefined &&
      typeof body[field] !== "string"
    ) {
      return "Invalid field type.";
    }
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (!name || !email || !message) {
    return "Name, email and message are required.";
  }

  if (name.length > MAX_LENGTHS.name) {
    return "Name is too long.";
  }

  if (email.length > MAX_LENGTHS.email) {
    return "Email is too long.";
  }

  if (subject.length > MAX_LENGTHS.subject) {
    return "Subject is too long.";
  }

  if (
    message.length < 10 ||
    message.length > MAX_LENGTHS.message
  ) {
    return "Message length is invalid.";
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(email)) {
    return "Invalid email address.";
  }

  return null;
}

async function checkRateLimit(ip) {
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("RATE_LIMIT_CONFIG_MISSING");
  }

  const key = `mash:contact:${ip}`;

  const luaScript = `
    local current = redis.call("INCR", KEYS[1])

    if current == 1 then
      redis.call("EXPIRE", KEYS[1], ARGV[1])
    end

    return current
  `;

  const response = await fetch(redisUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify([
      "EVAL",
      luaScript,
      "1",
      key,
      String(WINDOW_SECONDS)
    ])
  });

  if (!response.ok) {
    throw new Error("RATE_LIMIT_SERVICE_ERROR");
  }

  const result = await response.json();

  if (result.error) {
    throw new Error("RATE_LIMIT_SERVICE_ERROR");
  }

  const count = Number(result.result);

  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return count <= MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // POST only.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, {
      error: "Method not allowed."
    });
  }

  // JSON only.
  const contentType = req.headers["content-type"] || "";

  if (
    !contentType.toLowerCase().includes("application/json")
  ) {
    return send(res, 415, {
      error: "Content-Type must be application/json."
    });
  }

  // Check declared request size.
  const contentLength = Number(req.headers["content-length"]);

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return send(res, 413, {
      error: "Request body is too large."
    });
  }

  // Check actual parsed body size.
  let serializedBody;

  try {
    serializedBody = JSON.stringify(req.body);
  } catch (_) {
    return send(res, 400, {
      error: "Invalid request body."
    });
  }

  if (
    !serializedBody ||
    Buffer.byteLength(serializedBody, "utf8") > MAX_BODY_BYTES
  ) {
    return send(res, 413, {
      error: "Request body is too large."
    });
  }

  const body = req.body;

  // Validate input.
  const validationError = validateBody(body);

  if (validationError) {
    return send(res, 400, {
      error: validationError
    });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = (body.subject || "").trim();
  const message = body.message.trim();

  // Database configuration.
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  // Rate limiting.
  const clientIP = getClientIP(req);

  try {
    const allowed = await checkRateLimit(clientIP);

    if (!allowed) {
      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch (error) {
    console.error(
      "Contact rate limit error:",
      error.message
    );

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  // Save message to Neon PostgreSQL.
  try {
    const sql = neon(databaseUrl);

    await sql`
      INSERT INTO contact_messages
        (name, email, subject, message)
      VALUES
        (${name}, ${email}, ${subject || null}, ${message})
    `;

    return send(res, 201, {
      success: true,
      message: "Message received successfully."
    });

  } catch (error) {
    console.error(
      "Contact database error:",
      error.message
    );

    return send(res, 500, {
      error: "Could not save your message."
    });
  }
};
