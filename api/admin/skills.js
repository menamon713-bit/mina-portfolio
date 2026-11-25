"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");
const { guardAdminWrite } = require("../_lib/audit-log");

const MAX_BODY_BYTES = 8 * 1024;

const ALLOWED_FIELDS = [
  "name_ar",
  "name_en",
  "icon",
  "progress",
  "category",
  "is_visible",
  "sort_order"
];

const STRING_FIELDS = {
  name_ar: 150,
  name_en: 150,
  icon: 100,
  category: 100
};

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

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateBody(body, options = {}) {
  const { partial = false, allowId = false } = options;

  if (!isPlainObject(body)) return "Invalid request body.";

  for (const field of Object.keys(body)) {
    if (field === "id" && allowId) continue;
    if (!ALLOWED_FIELDS.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    if (!Object.hasOwn(body, field)) {
      if (
        !partial &&
        ["name_ar", "name_en"].includes(field)
      ) {
        return `Missing field: ${field}`;
      }

      continue;
    }

    if (typeof body[field] !== "string") {
      return `Invalid field: ${field}`;
    }

    const value = body[field].trim();

    if (value.length > maxLength) {
      return `Field ${field} is too long.`;
    }

    if (
      ["name_ar", "name_en"].includes(field) &&
      value.length === 0
    ) {
      return `Field ${field} cannot be empty.`;
    }
  }

  if (
    Object.hasOwn(body, "progress") &&
    (
      !Number.isInteger(body.progress) ||
      body.progress < 0 ||
      body.progress > 100
    )
  ) {
    return "Progress must be an integer between 0 and 100.";
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

  if (
    Object.hasOwn(body, "is_visible") &&
    typeof body.is_visible !== "boolean"
  ) {
    return "Invalid is_visible.";
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
      namespace: "skills",
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
          name_ar,
          name_en,
          icon,
          progress,
          category,
          is_visible,
          sort_order,
          created_at,
          updated_at
        FROM site_skills
        ORDER BY sort_order ASC, id ASC
      `);

      return res.status(200).json({
        skills: rows,
        count: rows.length
      });
    }

    const body = req.body;

    if (req.method === "POST") {
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await adminQuery(sql, sql`
        INSERT INTO site_skills (
          name_ar,
          name_en,
          icon,
          progress,
          category,
          is_visible,
          sort_order
        )
        VALUES (
          ${cleanString(body.name_ar)},
          ${cleanString(body.name_en)},
          ${cleanString(body.icon)},
          ${body.progress ?? 0},
          ${cleanString(body.category)},
          ${body.is_visible ?? true},
          ${body.sort_order ?? 0}
        )
        RETURNING *
      `);

      return res.status(201).json({
        message: "Skill created successfully.",
        skill: rows[0]
      });
    }

    if (req.method === "PATCH") {
      if (!isPlainObject(body) || !validId(body.id)) {
        return sendError(res, 400, "Invalid skill ID.");
      }

      const error = validateBody(body, {
        partial: true,
        allowId: true
      });

      if (error) return sendError(res, 400, error);

      if (!ALLOWED_FIELDS.some(field => Object.hasOwn(body, field))) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await adminQuery(sql, sql`
        UPDATE site_skills
        SET
          name_ar = COALESCE(${body.name_ar === undefined ? null : cleanString(body.name_ar)}, name_ar),
          name_en = COALESCE(${body.name_en === undefined ? null : cleanString(body.name_en)}, name_en),
          icon = COALESCE(${body.icon === undefined ? null : cleanString(body.icon)}, icon),
          progress = COALESCE(${body.progress ?? null}, progress),
          category = COALESCE(${body.category === undefined ? null : cleanString(body.category)}, category),
          is_visible = COALESCE(${body.is_visible ?? null}, is_visible),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order),
          updated_at = NOW()
        WHERE id = ${Number(body.id)}
        RETURNING *
      `);

      if (!rows.length) {
        return sendError(res, 404, "Skill not found.");
      }

      return res.status(200).json({
        message: "Skill updated successfully.",
        skill: rows[0]
      });
    }

    if (req.method === "DELETE") {
      if (
        !isPlainObject(body) ||
        !validId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid skill ID.");
      }

      const rows = await adminQuery(sql, sql`
        DELETE FROM site_skills
        WHERE id = ${Number(body.id)}
        RETURNING id
      `);

      if (!rows.length) {
        return sendError(res, 404, "Skill not found.");
      }

      return res.status(200).json({
        message: "Skill deleted successfully.",
        id: rows[0].id
      });
    }
  } catch (error) {
    console.error("[admin-skills] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    return sendError(res, 500, "An internal server error occurred.");
  }
};
