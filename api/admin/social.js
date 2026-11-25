"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");
const { guardAdminWrite } = require("../_lib/audit-log");

const MAX_BODY_BYTES = 12 * 1024;

const FIELDS = Object.freeze({
  platform: 50,
  label_ar: 120,
  label_en: 120,
  value: 500,
  url: 2048,
  icon: 100
});

const PATCH_FIELDS = [
  ...Object.keys(FIELDS),
  "is_visible",
  "sort_order"
];

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

function validUrl(value) {
  if (value === "") return true;

  try {
    const parsed = new URL(value);

    return (
      parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

function validateBody(body, options = {}) {
  const { partial = false, allowId = false } = options;

  if (!isPlainObject(body)) return "Invalid request body.";

  const allowed = allowId
    ? ["id", ...PATCH_FIELDS]
    : PATCH_FIELDS;

  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    if (!Object.hasOwn(body, field)) {
      if (
        !partial &&
        ["platform", "label_ar", "label_en", "url"].includes(field)
      ) {
        return `Missing field: ${field}`;
      }

      continue;
    }

    const value = body[field];

    if (
      typeof value !== "string" ||
      value.length > maxLength ||
      Buffer.byteLength(value, "utf8") > maxLength * 4
    ) {
      return `Invalid field: ${field}`;
    }

    if (
      ["platform", "label_ar", "label_en"].includes(field) &&
      !value.trim()
    ) {
      return `${field} cannot be empty.`;
    }
  }

  if (
    Object.hasOwn(body, "platform") &&
    !/^[a-zA-Z0-9_-]+$/.test(body.platform.trim())
  ) {
    return "Invalid platform name.";
  }

  if (
    Object.hasOwn(body, "url") &&
    !validUrl(body.url.trim())
  ) {
    return "URL must be a valid HTTPS link.";
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

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
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
      namespace: "social",
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
          platform,
          label_ar,
          label_en,
          value,
          url,
          icon,
          is_visible,
          sort_order
        FROM site_social_links
        ORDER BY sort_order ASC, id ASC
      `);

      return res.status(200).json({
        socialLinks: rows,
        count: rows.length
      });
    }

    const body = req.body;

    if (req.method === "POST") {
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await adminQuery(sql, sql`
        INSERT INTO site_social_links (
          platform,
          label_ar,
          label_en,
          value,
          url,
          icon,
          is_visible,
          sort_order
        )
        VALUES (
          ${body.platform.trim()},
          ${body.label_ar.trim()},
          ${body.label_en.trim()},
          ${clean(body.value)},
          ${body.url.trim()},
          ${clean(body.icon)},
          ${body.is_visible ?? true},
          ${body.sort_order ?? 0}
        )
        RETURNING *
      `);

      return res.status(201).json({
        message: "Social link created successfully.",
        socialLink: rows[0]
      });
    }

    if (req.method === "PATCH") {
      if (!isPlainObject(body) || !validId(body.id)) {
        return sendError(res, 400, "Invalid social link ID.");
      }

      const error = validateBody(body, {
        partial: true,
        allowId: true
      });

      if (error) return sendError(res, 400, error);

      if (!PATCH_FIELDS.some(field => Object.hasOwn(body, field))) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await adminQuery(sql, sql`
        UPDATE site_social_links
        SET
          platform = COALESCE(${body.platform === undefined ? null : body.platform.trim()}, platform),
          label_ar = COALESCE(${body.label_ar === undefined ? null : body.label_ar.trim()}, label_ar),
          label_en = COALESCE(${body.label_en === undefined ? null : body.label_en.trim()}, label_en),
          value = COALESCE(${body.value === undefined ? null : body.value.trim()}, value),
          url = COALESCE(${body.url === undefined ? null : body.url.trim()}, url),
          icon = COALESCE(${body.icon === undefined ? null : body.icon.trim()}, icon),
          is_visible = COALESCE(${body.is_visible ?? null}, is_visible),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order)
        WHERE id = ${Number(body.id)}
        RETURNING *
      `);

      if (!rows.length) {
        return sendError(res, 404, "Social link not found.");
      }

      return res.status(200).json({
        message: "Social link updated successfully.",
        socialLink: rows[0]
      });
    }

    if (req.method === "DELETE") {
      if (
        !isPlainObject(body) ||
        !validId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid social link ID.");
      }

      const rows = await adminQuery(sql, sql`
        DELETE FROM site_social_links
        WHERE id = ${Number(body.id)}
        RETURNING id
      `);

      if (!rows.length) {
        return sendError(res, 404, "Social link not found.");
      }

      return res.status(200).json({
        message: "Social link deleted successfully.",
        id: rows[0].id
      });
    }
  } catch (error) {
    console.error("[admin-social] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    return sendError(res, 500, "An internal server error occurred.");
  }
};
