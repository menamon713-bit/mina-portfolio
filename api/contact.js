"use strict";

const { neon } = require("@neondatabase/serverless");

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 600;
const MAX_BODY_BYTES = 12 * 1024;

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    const ip = forwarded.split(",")[0].trim();

    if (ip && ip.length <= 100) return ip;
  }

  const realIP = req.headers["x-real-ip"];

  if (typeof realIP === "string" && realIP.trim()) {
    const ip = realIP.trim();

    if (ip.length <= 100) return ip;
  }

  return null;
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { valid: false, error: "Invalid request" };
  }

  if (
    body.website !== undefined &&
    typeof body.website !== "string"
  ) {
    return { valid: false, error: "Invalid request" };
  }

  if (typeof body.website === "string" && body.website.trim()) {
    return { valid: true, spam: true };
  }

  const fields = ["name", "email", "subject", "message"];

  for (const field of fields) {
    if (
      body[field] !== undefined &&
      typeof body[field] !== "string"
    ) {
      return { valid: false, error: "Invalid input" };
    }
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const subject = (body.subject || "").trim();
  const message = (body.message || "").trim();

  if (!name || !email || !message) {
    return {
      valid: false,
      error: "Required fields are missing"
    };
  }

  if (
    name.length > 100 ||
    email.length > 254 ||
    subject.length > 200 ||
    message.length < 10 ||
    message.length > 5000
  ) {
    return {
      valid: false,
      error: "Invalid input length"
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: "Invalid email address"
    };
  }

  return {
    valid: true,
    data: { name, email, subject, message }
  };
}

async function checkRateLimit(ip) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Redis configuration missing");
  }

  const key = `mash:contact:${encodeURIComponent(ip)}`;

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
    throw new Error("Redis request failed");
  }

  const result = await response.json();

  if (
    result.error ||
    !Number.isSafeInteger(result.result) ||
    result.result < 1
  ) {
    throw new Error("Invalid Redis response");
  }

  return result.result > MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  const contentType = req.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return res.status(415).json({
      success: false,
      message: "Unsupported content type"
    });
  }

  const contentLength = Number(req.headers["content-length"]);

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return res.status(413).json({
      success: false,
      message: "Request body too large"
    });
  }

  if (
    !process.env.DATABASE_URL ||
    !process.env.KV_REST_API_URL ||
    !process.env.KV_REST_API_TOKEN
  ) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error"
    });
  }

  try {
    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    const bodyBytes = Buffer.byteLength(
      JSON.stringify(body),
      "utf8"
    );

    if (bodyBytes > MAX_BODY_BYTES) {
      return res.status(413).json({
        success: false,
        message: "Request body too large"
      });
    }

    const validation = validateBody(body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error
      });
    }

    if (validation.spam) {
      return res.status(200).json({
        success: true,
        message: "Message received"
      });
    }

    const ip = getClientIP(req);

    if (!ip) {
      return res.status(400).json({
        success: false,
        message: "Unable to process request"
      });
    }

    let limited;

    try {
      limited = await checkRateLimit(ip);
    } catch (error) {
      console.error("Rate limiter unavailable");

      return res.status(503).json({
        success: false,
        message: "Service temporarily unavailable"
      });
    }

    if (limited) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later."
      });
    }

    const { name, email, subject, message } = validation.data;

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      INSERT INTO contact_messages
        (name, email, subject, message)
      VALUES
        (${name}, ${email}, ${subject || null}, ${message})
    `;

    return res.status(201).json({
      success: true,
      message: "Your message has been sent successfully"
    });

  } catch (error) {
    console.error("Contact API error");

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};
