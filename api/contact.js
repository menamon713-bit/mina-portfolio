"use strict";

const { neon } = require("@neondatabase/serverless");

const { checkSameOrigin } = require("./_lib/admin-auth");
const { getClientKey } = require("./_lib/client-ip");
const { consume } = require("./_lib/rate-limit");

/* =====================================================
   CONFIGURATION
===================================================== */

const MAX_REQUESTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 600;

const GLOBAL_WINDOW_SECONDS = 3600;
const DEFAULT_GLOBAL_LIMIT = 100;
const GLOBAL_KEY = "mash:contact:global:v2";

const MAX_BODY_BYTES = 12 * 1024;

const MAX_LENGTHS = {
  name: 100,
  email: 254,
  subject: 200,
  message: 5000
};

const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "subject",
  "message",
  "website"
]);

const SINGLE_LINE_BAD = /[\u0000-\u001F\u007F\u2028\u2029]/;
const MESSAGE_BAD = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* =====================================================
   RESPONSE
===================================================== */

function send(res, status, payload) {
  return res.status(status).json(payload);
}

/* =====================================================
   GLOBAL RATE LIMIT
===================================================== */

function getGlobalLimit() {
  const raw = process.env.CONTACT_GLOBAL_LIMIT;

  if (raw === undefined || raw === "") {
    return DEFAULT_GLOBAL_LIMIT;
  }

  if (!/^\d+$/.test(raw)) {
    return DEFAULT_GLOBAL_LIMIT;
  }

  const value = Number(raw);

  return Number.isSafeInteger(value) &&
    value >= 10 &&
    value <= 10000
    ? value
    : DEFAULT_GLOBAL_LIMIT;
}

/* =====================================================
   REQUEST SIZE VALIDATION
===================================================== */

function validateBodySize(req) {
  const rawLength = req.headers["content-length"];

  if (rawLength !== undefined) {
    const value = String(rawLength).trim();

    if (!/^\d+$/.test(value)) {
      return {
        status: 400,
        error: "Invalid Content-Length."
      };
    }

    const declaredLength = Number(value);

    if (
      !Number.isSafeInteger(declaredLength) ||
      declaredLength < 0
    ) {
      return {
        status: 400,
        error: "Invalid Content-Length."
      };
    }

    if (declaredLength > MAX_BODY_BYTES) {
      return {
        status: 413,
        error: "Request body is too large."
      };
    }
  }

  let serializedBody;

  try {
    serializedBody = JSON.stringify(req.body);
  } catch {
    return {
      status: 400,
      error: "Invalid request body."
    };
  }

  if (typeof serializedBody !== "string") {
    return {
      status: 400,
      error: "Invalid request body."
    };
  }

  const actualLength = Buffer.byteLength(
    serializedBody,
    "utf8"
  );

  if (actualLength > MAX_BODY_BYTES) {
    return {
      status: 413,
      error: "Request body is too large."
    };
  }

  return null;
}

/* =====================================================
   BODY VALIDATION
===================================================== */

function validateBody(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return "Invalid request body.";
  }

  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) {
      return "Unexpected field.";
    }
  }

  if (
    body.website !== undefined &&
    typeof body.website !== "string"
  ) {
    return "Invalid submission.";
  }

  for (const field of [
    "name",
    "email",
    "subject",
    "message"
  ]) {
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

/* =====================================================
   HANDLER
===================================================== */

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  /* METHOD */

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return send(res, 405, {
      error: "Method not allowed."
    });
  }

  /* SAME ORIGIN */

  if (!checkSameOrigin(req)) {
    return send(res, 403, {
      error: "Forbidden origin."
    });
  }

  /* CONTENT TYPE */

  const contentType = req.headers["content-type"] || "";

  const mimeType = contentType
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (mimeType !== "application/json") {
    return send(res, 415, {
      error: "Content-Type must be application/json."
    });
  }

  /* BODY SIZE */

  const sizeError = validateBodySize(req);

  if (sizeError) {
    return send(res, sizeError.status, {
      error: sizeError.error
    });
  }

  /* DATABASE CONFIGURATION */

  const databaseUrl = process.env.DATABASE_URL;

  if (
    typeof databaseUrl !== "string" ||
    !databaseUrl.trim()
  ) {
    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  /* CLIENT IP */

  const clientIP = getClientKey(req);

  if (!clientIP) {
    return send(res, 400, {
      error: "Invalid client address."
    });
  }

  /* IP RATE LIMIT */

  try {
    const ipResult = await consume(
      `mash:contact:${clientIP}`,
      IP_WINDOW_SECONDS,
      MAX_REQUESTS_PER_IP
    );

    if (!ipResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(ipResult.retryAfter)
      );

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch {
    console.error("Contact IP rate limit unavailable.");

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  /* HONEYPOT */

  const body = req.body;

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    typeof body.website === "string" &&
    body.website.trim() !== ""
  ) {
    return send(res, 201, {
      success: true,
      message: "Message received successfully."
    });
  }

  /* INPUT VALIDATION */

  const validationError = validateBody(body);

  if (validationError) {
    return send(res, 400, {
      error: validationError
    });
  }

  /* NORMALIZE INPUT */

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = (body.subject || "").trim();

  const message = body.message
    .trim()
    .replace(/\r\n?/g, "\n");

  /* GLOBAL RATE LIMIT */

  try {
    const globalResult = await consume(
      GLOBAL_KEY,
      GLOBAL_WINDOW_SECONDS,
      getGlobalLimit()
    );

    if (!globalResult.allowed) {
      res.setHeader(
        "Retry-After",
        String(globalResult.retryAfter)
      );

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch {
    console.error("Contact global rate limit unavailable.");

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  /* DATABASE INSERT */

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
  } catch {
    console.error("Contact database operation failed.");

    return send(res, 500, {
      error: "Could not save your message."
    });
  }
};
