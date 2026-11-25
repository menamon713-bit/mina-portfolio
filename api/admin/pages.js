"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");
const { guardAdminWrite } = require("../_lib/audit-log");

const FIELDS = [
  "slug",
  "title_ar",
  "title_en",
  "content_ar",
  "content_en",
  "is_published"
];

const STRING_LIMITS = {
  slug: 150,
  title_ar: 500,
  title_en: 500,
  content_ar: 30000,
  content_en: 30000
};

const MAX_BODY_BYTES = 70 * 1024;

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validId(value) {
  if (typeof value !== "string" && typeof value !== "number") {
    return false;
  }

  const text = String(value);

  return (
    /^[1-9]\d*$/.test(text) &&
    Number.isSafeInteger(Number(text))
  );
}

function validateBody(body, options = {}) {
  const { partial = false, allowId = false } = options;

  if (!isPlainObject(body)) return "Invalid request body.";

  const allowed = allowId ? [...FIELDS, "id"] : FIELDS;

  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) return "Unknown field.";
  }

  if (!partial) {
    for (const field of [
      "slug",
      "title_ar",
      "title_en",
      "content_ar",
      "content_en"
    ]) {
      if (!Object.hasOwn(body, field)) {
        return `Missing field: ${field}`;
      }
    }
  }

  for (const [field, maxLength] of Object.entries(STRING_LIMITS)) {
    if (!Object.hasOwn(body, field)) continue;

    if (
      typeof body[field] !== "string" ||
      body[field].length > maxLength
    ) {
      return `Invalid field: ${field}`;
    }
  }

  if (
    Object.hasOwn(body, "slug") &&
    !/^[a-zA-Z0-9_-]+$/.test(body.slug)
  ) {
    return "Invalid page slug.";
  }

  for (const field of ["title_ar", "title_en"]) {
    if (
      Object.hasOwn(body, field) &&
      !body[field].trim()
    ) {
      return `${field} cannot be empty.`;
    }
  }

  if (
    Object.hasOwn(body, "is_published") &&
    typeof body.is_published !== "boolean"
  ) {
    return "Invalid is_published.";
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const methods = ["GET", "POST", "PATCH", "DELETE"];

  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) return;

  if (req.method !== "GET") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    if (!(await guardAdminWrite(req, res, {
      namespace: "pages",
      maxBodyBytes: MAX_BODY_BYTES
    }))) return;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (typeof databaseUrl !== "string" || !databaseUrl.trim()) {
    return sendError(res, 503, "Database is unavailable.");
  }

  try {
    const sql = neon(databaseUrl);

    if (req.method === "GET") {
      const rows = await adminQuery(sql, sql`
        SELECT
          id,
          slug,
          title_ar,
          title_en,
          content_ar,
          content_en,
          is_published,
          updated_at
        FROM site_pages
        ORDER BY id DESC
      `);

      return res.status(200).json({
        pages: rows,
        count: rows.length
      });
    }

    const body = req.body;

    if (req.method === "POST") {
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await adminQuery(sql, sql`
        INSERT INTO site_pages (
          slug,
          title_ar,
          title_en,
          content_ar,
          content_en,
          is_published,
          updated_at
        )
        VALUES (
          ${body.slug.trim()},
          ${body.title_ar.trim()},
          ${body.title_en.trim()},
          ${body.content_ar},
          ${body.content_en},
          ${body.is_published ?? false},
          NOW()
        )
        RETURNING *
      `);

      return res.status(201).json({
        message: "Page created successfully.",
        page: rows[0]
      });
    }

    if (req.method === "PATCH") {
      if (!isPlainObject(body) || !validId(body.id)) {
        return sendError(res, 400, "Invalid page ID.");
      }

      const error = validateBody(body, {
        partial: true,
        allowId: true
      });

      if (error) return sendError(res, 400, error);

      if (!FIELDS.some(field => Object.hasOwn(body, field))) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await adminQuery(sql, sql`
        UPDATE site_pages
        SET
          slug = COALESCE(${body.slug === undefined ? null : body.slug.trim()}, slug),
          title_ar = COALESCE(${body.title_ar === undefined ? null : body.title_ar.trim()}, title_ar),
          title_en = COALESCE(${body.title_en === undefined ? null : body.title_en.trim()}, title_en),
          content_ar = COALESCE(${body.content_ar ?? null}, content_ar),
          content_en = COALESCE(${body.content_en ?? null}, content_en),
          is_published = COALESCE(${body.is_published ?? null}, is_published),
          updated_at = NOW()
        WHERE id = ${Number(body.id)}
        RETURNING *
      `);

      if (!rows.length) {
        return sendError(res, 404, "Page not found.");
      }

      return res.status(200).json({
        message: "Page updated successfully.",
        page: rows[0]
      });
    }

    if (req.method === "DELETE") {
      if (
        !isPlainObject(body) ||
        !validId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid page ID.");
      }

      const rows = await adminQuery(sql, sql`
        DELETE FROM site_pages
        WHERE id = ${Number(body.id)}
        RETURNING id
      `);

      if (!rows.length) {
        return sendError(res, 404, "Page not found.");
      }

      return res.status(200).json({
        message: "Page deleted successfully.",
        id: rows[0].id
      });
    }
  } catch (error) {
    console.error("[admin-pages] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    if (error?.code === "23505") {
      return sendError(res, 409, "Page slug already exists.");
    }

    return sendError(res, 500, "An internal server error occurred.");
  }
};
