"use strict";

const { neon } = require("@neondatabase/serverless");
const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const sql = neon(process.env.DATABASE_URL);

const FIELDS = {
  full_name: 120,
  job_title: 180,
  short_bio: 2000,
  about: 5000,
  location: 120,
  email: 255,
  profile_image: 2000
};

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function validateProfile(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    const value = body[field];

    if (typeof value !== "string") {
      return `Invalid field: ${field}`;
    }

    if (value.length > maxLength) {
      return `${field} exceeds the maximum length.`;
    }

    if (value.trim() !== value && field === "full_name") {
      return "Invalid full name.";
    }
  }

  if (!body.full_name.trim()) {
    return "Full name is required.";
  }

  if (
    body.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
  ) {
    return "Invalid email address.";
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!requireAdmin(req, res)) return;

  if (req.method === "POST" && !checkSameOrigin(req)) {
    return sendError(res, 403, "Invalid request origin.");
  }

  try {
    if (req.method === "GET") {
      const rows = await sql`
        SELECT
          full_name,
          job_title,
          short_bio,
          about,
          location,
          email,
          profile_image,
          updated_at
        FROM site_profile
        ORDER BY id ASC
        LIMIT 1
      `;

      if (!rows.length) {
        return sendError(res, 404, "Profile not found.");
      }

      return res.status(200).json({
        profile: rows[0]
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
        profile_image = ${values.profile_image},
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
        profile_image,
        updated_at
    `;

    if (!rows.length) {
      return sendError(res, 404, "Profile not found.");
    }

    return res.status(200).json({
      message: "Profile updated successfully.",
      profile: rows[0]
    });

  } catch (error) {
    console.error("Admin profile API error:", error);

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
