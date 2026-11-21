"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const MAX_LENGTH = {
  content_key: 150,
  section: 100,
  title_ar: 5000,
  title_en: 5000,
  content_ar: 20000,
  content_en: 20000
};

const FIELDS = Object.keys(MAX_LENGTH);
const PATCH_FIELDS = [...FIELDS, "is_visible", "sort_order"];

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

function validateBody(body, allowedFields, requiredFields = []) {
  if (!isPlainObject(body)) {
    return "Invalid request body.";
  }

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const field of requiredFields) {
    if (!Object.hasOwn(body, field)) {
      return `Missing field: ${field}`;
    }
  }

  for (const field of FIELDS) {
    if (!Object.hasOwn(body, field)) continue;

    if (typeof body[field] !== "string") {
      return `Invalid field: ${field}`;
    }

    if (body[field].length > MAX_LENGTH[field]) {
      return `${field} exceeds the maximum length.`;
    }
  }

  if (
    Object.hasOwn(body, "content_key") &&
    !/^[a-zA-Z0-9_.-]+$/.test(body.content_key)
  ) {
    return "Invalid content key.";
  }

  if (
    Object.hasOwn(body, "is_visible") &&
    typeof body.is_visible !== "boolean"
  ) {
    return "Invalid is_visible.";
  }

  if (
    Object.hasOwn(body, "sort_order") &&
    (
      !Number.isSafeInteger(body.sort_order) ||
      body.sort_order < 0
    )
  ) {
    return "Invalid sort_order.";
  }

  return null;
}

function validateId(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }

  const text = String(value);

  return (
    /^[1-9]\d*$/.test(text) &&
    Number.isSafeInteger(Number(text))
  );
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const allowedMethods = ["GET", "POST", "PATCH", "DELETE"];

  if (!allowedMethods.includes(req.method)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET" && !checkSameOrigin(req)) {
    return sendError(res, 403, "Invalid request origin.");
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return sendError(res, 503, "Database is unavailable.");
  }

  try {
    const sql = neon(databaseUrl);

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

    if (req.method === "POST") {
      const body = req.body;

      const error = validateBody(
        body,
        FIELDS,
        FIELDS
      );

      if (error) return sendError(res, 400, error);

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

    if (req.method === "PATCH") {
      const body = req.body;

      if (!isPlainObject(body) || !validateId(body.id)) {
        return sendError(res, 400, "Invalid content ID.");
      }

      const error = validateBody(
        body,
        ["id", ...PATCH_FIELDS]
      );

      if (error) return sendError(res, 400, error);

      const hasUpdates = PATCH_FIELDS.some(
        (field) => Object.hasOwn(body, field)
      );

      if (!hasUpdates) {
        return sendError(res, 400, "No fields to update.");
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
          is_visible = COALESCE(${body.is_visible ?? null}, is_visible),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order),
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

    if (req.method === "DELETE") {
      const body = req.body;

      if (
        !isPlainObject(body) ||
        !validateId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid content ID.");
      }

      const rows = await sql`
        DELETE FROM site_content
        WHERE id = ${Number(body.id)}
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
    if (error && error.code === "23505") {
      return sendError(res, 409, "Content key already exists.");
    }

    console.error("[admin-content] Database operation failed.");

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
