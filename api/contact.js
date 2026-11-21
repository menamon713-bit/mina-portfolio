"use strict";

const { neon } = require("@neondatabase/serverless");

const { checkSameOrigin } = require("./_lib/admin-auth");
const { getClientKey } = require("./_lib/client-ip");
const { hit } = require("./_lib/rate-limit");

const MAX_REQUESTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 600;

// Total messages accepted from everyone per hour (protects the database
// from distributed floods). Override with CONTACT_GLOBAL_LIMIT in Vercel env.
const GLOBAL_WINDOW_SECONDS = 3600;
const DEFAULT_GLOBAL_LIMIT = 100;
const GLOBAL_KEY = "mash:contact:global";

const MAX_BODY_BYTES = 12 * 1024;

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000
};

// PostgreSQL text cannot hold NUL, and control characters have no
// business in a name/email/subject. The message may keep \n, \r and \t.
const SINGLE_LINE_BAD = /[\u0000-\u001F\u007F\u2028\u2029]/;
const MESSAGE_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function send(res, status, payload) {
  return res.status(status).json(payload);
}

function getGlobalLimit() {
  const value = Number(process.env.CONTACT_GLOBAL_LIMIT);

  return Number.isSafeInteger(value) && value >= 10 && value <= 10000
    ? value
    : DEFAULT_GLOBAL_LIMIT;
}

function isHoneypotFilled(body) {
  return (
    body &&
    typeof body === "object" &&
    typeof body.website === "string" &&
    body.website.trim() !== ""
  );
}

function validateBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  if (body.website !== undefined && typeof body.website !== "string") {
    return "Invalid submission.";
  }

  for (const field of ["name", "email", "subject", "message"]) {
    if (body[field] !== undefined && typeof body[field] !== "string") {
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

  if (name.length > MAX_LENGTHS.name) return "Name is too long.";
  if (email.length > MAX_LENGTHS.email) return "Email is too long.";
  if (subject.length > MAX_LENGTHS.subject) return "Subject is too long.";

  if (message.length < 10 || message.length > MAX_LENGTHS.message) {
    return "Message length is invalid.";
  }

  if (
    SINGLE_LINE_BAD.test(name) ||
    SINGLE_LINE_BAD.test(email) ||
    SINGLE_LINE_BAD.test(subject) ||
    MESSAGE_BAD.test(message)
  ) {
    return "Invalid characters.";
  }

  if (!EMAIL_PATTERN.test(email)) {
    return "Invalid email address.";
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // POST only.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, { error: "Method not allowed." });
  }

  // Browser requests must come from this site.
  if (!checkSameOrigin(req)) {
    return send(res, 403, { error: "Forbidden origin." });
  }

  // JSON only.
  const contentType = req.headers["content-type"] || "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return send(res, 415, {
      error: "Content-Type must be application/json."
    });
  }

  // Declared size.
  const contentLength = Number(req.headers["content-length"]);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return send(res, 413, { error: "Request body is too large." });
  }

  // Actual parsed size.
  let serializedBody;

  try {
    serializedBody = JSON.stringify(req.body);
  } catch (_) {
    return send(res, 400, { error: "Invalid request body." });
  }

  if (
    !serializedBody ||
    Buffer.byteLength(serializedBody, "utf8") > MAX_BODY_BYTES
  ) {
    return send(res, 413, { error: "Request body is too large." });
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  // Rate limits run BEFORE validation, so invalid spam is counted too.
  try {
    const clientKey = getClientKey(req);

    const ipCount = await hit(
      `mash:contact:${clientKey}`,
      IP_WINDOW_SECONDS
    );

    if (ipCount > MAX_REQUESTS_PER_IP) {
      res.setHeader("Retry-After", String(IP_WINDOW_SECONDS));

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }

    const globalCount = await hit(GLOBAL_KEY, GLOBAL_WINDOW_SECONDS);

    if (globalCount > getGlobalLimit()) {
      res.setHeader("Retry-After", String(GLOBAL_WINDOW_SECONDS));

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch (error) {
    console.error("Contact rate limit error:", error.message);

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  const body = req.body;

  // Honeypot: pretend it worked so bots don't learn they were caught.
  if (isHoneypotFilled(body)) {
    return send(res, 201, {
      success: true,
      message: "Message received successfully."
    });
  }

  const validationError = validateBody(body);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = (body.subject || "").trim();
  const message = body.message.trim().replace(/\r\n?/g, "\n");

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
    console.error("Contact database error:", error.message);

    return send(res, 500, { error: "Could not save your message." });
  }
};
