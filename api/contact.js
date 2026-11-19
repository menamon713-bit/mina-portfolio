"use strict";

const { neon } = require("@neondatabase/serverless");

const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 600;

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().slice(0, 100);
  }

  const realIP = req.headers["x-real-ip"];

  if (typeof realIP === "string" && realIP.trim()) {
    return realIP.trim().slice(0, 100);
  }

  return "unknown";
}

async function checkRateLimit(ip) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error("Redis configuration missing");
  }

  const key = `mash:contact:${encodeURIComponent(ip)}`;

  // Atomic increment with automatic expiration.
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
      "Authorization": `Bearer ${token}`,
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

  const data = await response.json();

  if (typeof data.result !== "number") {
    throw new Error("Invalid Redis response");
  }

  return data.result > MAX_REQUESTS;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
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
    const ip = getClientIP(req);

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

    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid request"
      });
    }

    // Honeypot
    if (
      typeof body.website === "string" &&
      body.website.trim() !== ""
    ) {
      return res.status(200).json({
        success: true,
        message: "Message received"
      });
    }

    const name = typeof body.name === "string"
      ? body.name.trim()
      : "";

    const email = typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

    const subject = typeof body.subject === "string"
      ? body.subject.trim()
      : "";

    const message = typeof body.message === "string"
      ? body.message.trim()
      : "";

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing"
      });
    }

    if (
      name.length > 100 ||
      email.length > 254 ||
      subject.length > 200 ||
      message.length < 10 ||
      message.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid input length"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address"
      });
    }

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
