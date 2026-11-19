"use strict";

const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

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

    // Honeypot anti-spam field
    if (body.website) {
      return res.status(200).json({
        success: true,
        message: "Message received"
      });
    }

    // Required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields"
      });
    }

    // Length validation
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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address"
      });
    }

    // Save message in Neon PostgreSQL
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
    console.error("Contact API error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};
