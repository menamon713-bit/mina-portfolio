"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");

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

const SEO_LIMITS = {
  page_slug: 100,
  title_ar: 500,
  title_en: 500,
  description_ar: 1000,
  description_en: 1000,
  keywords_ar: 2000,
  keywords_en: 2000,
  og_image: 2000,
  canonical_url: 2000
};

const SEO_FIELDS = Object.keys(SEO_LIMITS);

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

function validateSeoBody(body) {
  if (!isPlainObject(body)) {
    return "Invalid request body.";
  }

  for (const field of Object.keys(body)) {
    if (!SEO_FIELDS.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const field of SEO_FIELDS) {
    if (!Object.hasOwn(body, field)) continue;

    if (
      typeof body[field] !== "string" ||
      body[field].length > SEO_LIMITS[field]
    ) {
      return `Invalid field: ${field}`;
    }
  }

  if (
    typeof body.page_slug !== "string" ||
    !/^[a-zA-Z0-9_-]+$/.test(body.page_slug)
  ) {
    return "Invalid page slug.";
  }

  if (
    typeof body.title_ar !== "string" ||
    typeof body.title_en !== "string" ||
    !body.title_ar.trim() ||
    !body.title_en.trim()
  ) {
    return "Arabic and English titles are required.";
  }

  for (const field of ["canonical_url", "og_image"]) {
    const value = body[field];

    if (!value) continue;

    try {
      const url = new URL(value);

      if (!["http:", "https:"].includes(url.protocol)) {
        return `Invalid ${field}.`;
      }
    } catch {
      return `Invalid ${field}.`;
    }
  }

  return null;
}

async function handleSeo(sql, req, res) {
  if (req.method === "GET") {
    const rows = await adminQuery(
      sql,
      sql`
        SELECT
          id,
          page_slug,
          title_ar,
          title_en,
          description_ar,
          description_en,
          keywords_ar,
          keywords_en,
          og_image,
          canonical_url,
          updated_at
        FROM site_seo
        ORDER BY page_slug ASC
      `
    );

    return res.status(200).json({
      seo: rows,
      count: rows.length
    });
  }

  if (req.method === "POST") {
    const body = req.body;
    const error = validateSeoBody(body);

    if (error) return sendError(res, 400, error);

    const rows = await adminQuery(
      sql,
      sql`
        INSERT INTO site_seo (
          page_slug,
          title_ar,
          title_en,
          description_ar,
          description_en,
          keywords_ar,
          keywords_en,
          og_image,
          canonical_url,
          updated_at
        )
        VALUES (
          ${body.page_slug.trim()},
          ${body.title_ar.trim()},
          ${body.title_en.trim()},
          ${body.description_ar || ""},
          ${body.description_en || ""},
          ${body.keywords_ar || ""},
          ${body.keywords_en || ""},
          ${body.og_image || ""},
          ${body.canonical_url || ""},
          NOW()
        )
        ON CONFLICT (page_slug)
        DO UPDATE SET
          title_ar = EXCLUDED.title_ar,
          title_en = EXCLUDED.title_en,
          description_ar = EXCLUDED.description_ar,
          description_en = EXCLUDED.description_en,
          keywords_ar = EXCLUDED.keywords_ar,
          keywords_en = EXCLUDED.keywords_en,
          og_image = EXCLUDED.og_image,
          canonical_url = EXCLUDED.canonical_url,
          updated_at = NOW()
        RETURNING *
      `
    );

    return res.status(200).json({
      message: "SEO settings saved successfully.",
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
      return sendError(res, 400, "Invalid SEO record ID.");
    }

    const rows = await adminQuery(
      sql,
      sql`
        DELETE FROM site_seo
        WHERE id = ${Number(body.id)}
        RETURNING id
      `
    );

    if (!rows.length) {
      return sendError(res, 404, "SEO record not found.");
    }

    return res.status(200).json({
      message: "SEO record deleted successfully.",
      id: rows[0].id
    });
  }

  return sendError(res, 405, "Method not allowed.");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const allowedMethods = ["GET", "POST", "PATCH", "DELETE"];

  if (!allowedMethods.includes(req.method)) {
    res.setHeader("Allow", allowedMethods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) return;

  if (req.method !== "GET" && !checkSameOrigin(req)) {
    return sendError(res, 403, "Invalid request origin.");
  }

  if (req.method !== "GET") {
    const contentType = req.headers["content-type"] || "";

    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }

    let bodySize;

    try {
      bodySize = Buffer.byteLength(
        JSON.stringify(req.body ?? null),
        "utf8"
      );
    } catch {
      return sendError(res, 400, "Invalid request body.");
    }

    if (bodySize > 20 * 1024) {
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

    if (req.query?.resource === "seo") {
      return await handleSeo(sql, req, res);
    }

    if (req.method === "GET") {
      const query = sql`
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

      const rows = await adminQuery(sql, query);

      return res.status(200).json({
        content: rows,
        count: rows.length
      });
    }

    if (req.method === "POST") {
      const body = req.body;
      const error = validateBody(body, FIELDS, FIELDS);

      if (error) return sendError(res, 400, error);

      const query = sql`
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

      const rows = await adminQuery(sql, query);

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

      const error = validateBody(body, ["id", ...PATCH_FIELDS]);

      if (error) return sendError(res, 400, error);

      const hasUpdates = PATCH_FIELDS.some(
        (field) => Object.hasOwn(body, field)
      );

      if (!hasUpdates) {
        return sendError(res, 400, "No fields to update.");
      }

      const query = sql`
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

      const rows = await adminQuery(sql, query);

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

      const query = sql`
        DELETE FROM site_content
        WHERE id = ${Number(body.id)}
        RETURNING id
      `;

      const rows = await adminQuery(sql, query);

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
