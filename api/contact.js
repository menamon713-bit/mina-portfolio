"use strict";

const { neon } = require("@neondatabase/serverless");

const { checkSameOrigin } = require("./_lib/admin-auth");
const { getClientKey } = require("./_lib/client-ip");
const { consume } = require("./_lib/rate-limit");

const MAX_REQUESTS_PER_IP = 5;
const IP_WINDOW_SECONDS = 600;

const GLOBAL_WINDOW_SECONDS = 3600;
const DEFAULT_GLOBAL_LIMIT = 300;
const GLOBAL_KEY = "mash:contact:global:v3";

const MAX_BODY_BYTES = 12 * 1024;

const MAX_LENGTHS = Object.freeze({
  name: 100,
  email: 254,
  subject: 200,
  message: 5000
});

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

function send(res, status, payload) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(status).json(payload);
}

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

function validateBodySize(req) {
  const rawLength = req.headers?.["content-length"];

  if (rawLength !== undefined) {
    const value = String(rawLength).trim();

    if (!/^\d+$/.test(value)) {
      return { status: 400, error: "Invalid Content-Length." };
    }

    const declaredLength = Number(value);

    if (!Number.isSafeInteger(declaredLength)) {
      return { status: 400, error: "Invalid Content-Length." };
    }

    if (declaredLength > MAX_BODY_BYTES) {
      return { status: 413, error: "Request body is too large." };
    }
  }

  let serializedBody;

  try {
    serializedBody = JSON.stringify(req.body);
  } catch {
    return { status: 400, error: "Invalid request body." };
  }

  if (typeof serializedBody !== "string") {
    return { status: 400, error: "Invalid request body." };
  }

  if (
    Buffer.byteLength(serializedBody, "utf8") > MAX_BODY_BYTES
  ) {
    return { status: 413, error: "Request body is too large." };
  }

  return null;
}

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

  if (
    name.length > MAX_LENGTHS.name ||
    email.length > MAX_LENGTHS.email ||
    subject.length > MAX_LENGTHS.subject
  ) {
    return "A field is too long.";
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

async function applyRateLimit(key, windowSeconds, limit) {
  const result = await consume(key, windowSeconds, limit);
  return result;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!checkSameOrigin(req)) {
    return send(res, 403, { error: "Forbidden origin." });
  }

  const contentType = req.headers?.["content-type"];

  if (
    typeof contentType !== "string" ||
    contentType.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    return send(res, 415, {
      error: "Content-Type must be application/json."
    });
  }

  const sizeError = validateBodySize(req);

  if (sizeError) {
    return send(res, sizeError.status, {
      error: sizeError.error
    });
  }

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

  const validationError = validateBody(body);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  const clientIP = getClientKey(req);

  if (!clientIP) {
    return send(res, 400, {
      error: "Invalid client address."
    });
  }

  try {
    const ipResult = await applyRateLimit(
      `mash:contact:${clientIP}`,
      IP_WINDOW_SECONDS,
      MAX_REQUESTS_PER_IP
    );

    if (!ipResult.allowed) {
      res.setHeader("Retry-After", String(ipResult.retryAfter));

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch {
    console.error("[contact] IP rate limit unavailable.");

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (
    typeof databaseUrl !== "string" ||
    !databaseUrl.trim()
  ) {
    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  try {
    const globalResult = await applyRateLimit(
      GLOBAL_KEY,
      GLOBAL_WINDOW_SECONDS,
      getGlobalLimit()
    );

    if (!globalResult.allowed) {
      res.setHeader("Retry-After", String(globalResult.retryAfter));

      return send(res, 429, {
        error: "Too many requests. Please try again later."
      });
    }
  } catch {
    console.error("[contact] Global rate limit unavailable.");

    return send(res, 503, {
      error: "Contact service is temporarily unavailable."
    });
  }

  const name = body.name.trim();
  const email = body.email.trim();
  const subject = (body.subject || "").trim();
  const message = body.message.trim().replace(/\r\n?/g, "\n");

  try {
    const sql = neon(databaseUrl);

    await sql`
      INSERT INTO public.contact_messages
        (name, email, subject, message)
      VALUES
        (${name}, ${email}, ${subject || null}, ${message})
    `;

    return send(res, 201, {
      success: true,
      message: "Message received successfully."
    });
  } catch (error) {
    console.error("[contact] Database insert failed.", {
      code: error?.code || "NO_CODE"
    });

    return send(res, 500, {
      error: "Could not save your message."
    });
  }
};
