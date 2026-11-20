"use strict";

const { neon } = require("@neondatabase/serverless");
const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const sql = neon(process.env.DATABASE_URL);

const MAX_LENGTH = {
  content_key: 150,
  section: 100,
  title_ar: 5000,
  title_en: 5000,
  content_ar: 20000,
  content_en: 20000
};

const FIELDS = Object.keys(MAX_LENGTH);

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function validateBody(body, fields, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  for (const field of fields) {
    if (partial && !Object.hasOwn(body, field)) {
      continue;
    }

    const value = body[field];

    if (typeof value !== "string") {
      return `Invalid field: ${field}`;
    }

    if (value.length > MAX_LENGTH[field]) {
      return `${field} exceeds the maximum length.`;
    }
  }

  if (!partial) {
    for (const field of fields) {
      if (!Object.hasOwn(body, field)) {
        return `Missing field: ${field}`;
      }
    }
  }

  if (
    Object.hasOwn(body, "content_key") &&
    !/^[a-zA-Z0-9_.-]+$/.test(body.content_key)
  ) {
    return "Invalid content key.";
  }

  return null;
}

function validateId(value) {
  return (
    typeof value === "string" ||
    typeof value === "number"
  ) &&
    /^\d+$/.test(String(value)) &&
    Number(value) > 0;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const allowedMethods = ["GET", "POST", "PATCH", "DELETE"];

  if (!allowedMethods.includes(req.method)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!requireAdmin(req, res)) return;

  if (
    req.method !== "GET" &&
    !checkSameOrigin(req)
  ) {
    return sendError(res, 403, "Invalid request origin.");
  }

  try {
    // GET: List all content
    if (req.method === "GET") {
      const rows = await sql`
        SELECT
          id,
          content_key,
          section,
          title_ar,
          title_en,
          content_ar,
          content_en,
          is_visible,
          sort_order,
          updated_at
        FROM site_content
        ORDER BY section ASC, sort_order ASC, id ASC
      `;

      return res.status(200).json({
        content: rows,
        count: rows.length
      });
    }

    // POST: Create content
    if (req.method === "POST") {
      const validationError = validateBody(
        req.body,
        FIELDS
      );

      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const body = req.body;

      const rows = await sql`
        INSERT INTO site_content (
          content_key,
          section,
          title_ar,
          title_en,
          content_ar,
          content_en
        )
        VALUES (
          ${body.content_key},
          ${body.section},
          ${body.title_ar},
          ${body.title_en},
          ${body.content_ar},
          ${body.content_en}
        )
        RETURNING *
      `;

      return res.status(201).json({
        message: "Content created successfully.",
        item: rows[0]
      });
    }

    // PATCH: Update content
    if (req.method === "PATCH") {
      const body = req.body;

      if (!validateId(body?.id)) {
        return sendError(res, 400, "Invalid content ID.");
      }

      const validationError = validateBody(
        body,
        FIELDS,
        true
      );

      if (validationError) {
        return sendError(res, 400, validationError);
      }

      const rows = await sql`
        UPDATE site_content
        SET
          content_key = COALESCE(${body.content_key ?? null}, content_key),
          section = COALESCE(${body.section ?? null}, section),
          title_ar = COALESCE(${body.title_ar ?? null}, title_ar),
          title_en = COALESCE(${body.title_en ?? null}, title_en),
          content_ar = COALESCE(${body.content_ar ?? null}, content_ar),
          content_en = COALESCE(${body.content_en ?? null}, content_en),
          is_visible = COALESCE(${typeof body.is_visible === "boolean" ? body.is_visible : null}, is_visible),
          sort_order = COALESCE(${Number.isInteger(body.sort_order) ? body.sort_order : null}, sort_order),
          updated_at = NOW()
        WHERE id = ${Number(body.id)}
        RETURNING *
      `;

      if (!rows.length) {
        return sendError(res, 404, "Content not found.");
      }

      return res.status(200).json({
        message: "Content updated successfully.",
        item: rows[0]
      });
    }

    // DELETE: Delete content
    if (req.method === "DELETE") {
      const id = req.body?.id;

      if (!validateId(id)) {
        return sendError(res, 400, "Invalid content ID.");
      }

      const rows = await sql`
        DELETE FROM site_content
        WHERE id = ${Number(id)}
        RETURNING id
      `;

      if (!rows.length) {
        return sendError(res, 404, "Content not found.");
      }

      return res.status(200).json({
        message: "Content deleted successfully.",
        id: rows[0].id
      });
    }

  } catch (error) {
    console.error("Admin content API error:", error);

    if (error.code === "23505") {
      return sendError(res, 409, "Content key already exists.");
    }

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
