"use strict";

const { neon } = require("@neondatabase/serverless");

const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60 * 1000;
const requests = new Map();

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }

  return req.headers["x-real-ip"] || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const record = requests.get(ip);

  if (!record || now - record.start > WINDOW_MS) {
    requests.set(ip, { start: now, count: 1 });
    return false;
  }

  record.count += 1;
  return record.count > MAX_REQUESTS;
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

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      success: false,
      message: "Server configuration error"
    });
  }

  try {
    const body = req.body || {};

    // Honeypot
    if (body.website) {
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

    const ip = getClientIP(req);

    if (isRateLimited(ip)) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later."
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
