"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const FIELDS = {
  full_name: 120,
  job_title: 180,
  short_bio: 2000,
  about: 5000,
  location: 120,
  email: 255,
  image: 2000
};

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
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
      url.hostname.length > 0 &&
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

  const allowedFields = Object.keys(FIELDS);

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    if (!Object.hasOwn(body, field)) {
      return `Missing field: ${field}`;
    }

    if (typeof body[field] !== "string") {
      return `Invalid field: ${field}`;
    }

    if (body[field].length > maxLength) {
      return `${field} exceeds the maximum length.`;
    }
  }

  if (!body.full_name.trim()) {
    return "Full name is required.";
  }

  if (
    body.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
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

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) {
    return;
  }

  if (
    req.method === "POST" &&
    !checkSameOrigin(req)
  ) {
    return sendError(res, 403, "Invalid request origin.");
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return sendError(res, 503, "Database is unavailable.");
  }

  try {
    const sql = neon(databaseUrl);

    if (req.method === "GET") {
      const dbIdentity = await sql`
        SELECT current_user AS database_user
      `;

      const rows = await sql`
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

      if (!rows.length) {
        return sendError(res, 404, "Profile not found.");
      }

      return res.status(200).json({
        profile: rows[0],
        databaseUser: dbIdentity[0].database_user
      });
    }

    const body = req.body;
    const validationError = validateProfile(body);

    if (validationError) {
      return sendError(res, 400, validationError);
    }

    const values = Object.fromEntries(
      Object.keys(FIELDS).map((field) => [
        field,
        body[field].trim()
      ])
    );

    const rows = await sql`
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

    if (!rows.length) {
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
