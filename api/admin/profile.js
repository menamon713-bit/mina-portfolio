"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");

const FIELDS = Object.freeze({
  full_name: 120,
  job_title: 180,
  short_bio: 2000,
  about: 5000,
  location: 120,
  email: 255,
  image: 2000
});

const MAX_BODY_BYTES = 12 * 1024;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function validImageUrl(value) {
  if (value === "") return true;

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u0020]/.test(value)
  ) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function validateProfile(body) {
  if (!isPlainObject(body)) {
    return "Invalid request body.";
  }

  const fields = Object.keys(FIELDS);
  const received = Object.keys(body);

  if (
    received.length !== fields.length ||
    received.some((field) => !Object.hasOwn(FIELDS, field))
  ) {
    return "Invalid request fields.";
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    const value = body[field];

    if (
      typeof value !== "string" ||
      value.length > maxLength ||
      Buffer.byteLength(value, "utf8") > maxLength * 4
    ) {
      return `Invalid field: ${field}`;
    }
  }

  if (!body.full_name.trim()) {
    return "Full name is required.";
  }

  const email = body.email.trim();

  if (
    email &&
    (
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    )
  ) {
    return "Invalid email address.";
  }

  if (!validImageUrl(body.image.trim())) {
    return "Invalid profile image URL.";
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) {
    return;
  }

  if (req.method === "POST") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    if (
      !req.headers["content-type"] ||
      !/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"])
    ) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }

    if (
      Buffer.byteLength(
        JSON.stringify(req.body ?? null),
        "utf8"
      ) > MAX_BODY_BYTES
    ) {
      return sendError(res, 413, "Request body is too large.");
    }
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (
    typeof databaseUrl !== "string" ||
    !databaseUrl.trim()
  ) {
    return sendError(res, 503, "Database is unavailable.");
  }

  try {
    const sql = neon(databaseUrl);

    if (req.method === "GET") {
      const query = sql`
        SELECT
          full_name,
          job_title,
          short_bio,
          about,
          location,
          email,
          profile_image AS image,
          updated_at
        FROM site_profile
        ORDER BY id ASC
        LIMIT 1
      `;

      const rows = await adminQuery(sql, query);

      if (rows.length === 0) {
        return sendError(res, 404, "Profile not found.");
      }

      return res.status(200).json({
        profile: rows[0]
      });
    }

    const validationError = validateProfile(req.body);

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const values = Object.fromEntries(
      Object.keys(FIELDS).map((field) => [
        field,
        req.body[field].trim()
      ])
    );

    const query = sql`
      UPDATE site_profile
      SET
        full_name = ${values.full_name},
        job_title = ${values.job_title},
        short_bio = ${values.short_bio},
        about = ${values.about},
        location = ${values.location},
        email = ${values.email},
        profile_image = ${values.image},
        updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM site_profile
        ORDER BY id ASC
        LIMIT 1
      )
      RETURNING
        full_name,
        job_title,
        short_bio,
        about,
        location,
        email,
        profile_image AS image,
        updated_at
    `;

    const rows = await adminQuery(sql, query);

    if (rows.length === 0) {
      return sendError(res, 404, "Profile not found.");
    }

    return res.status(200).json({
      message: "Profile updated successfully.",
      profile: rows[0]
    });
  } catch {
    console.error("[admin-profile] Database operation failed.");

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
