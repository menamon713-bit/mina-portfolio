"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");

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
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
  );
}

function validId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
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
  const {
    partial = false,
    allowId = false
  } = options;

  if (!isPlainObject(body)) {
    return "Invalid request body.";
  }

  const allowedFields = allowId
    ? ["id", ...PATCH_FIELDS]
    : PATCH_FIELDS;

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      return `Unknown field: ${field}`;
    }
  }

  for (const [field, maxLength] of Object.entries(FIELDS)) {
    if (!Object.hasOwn(body, field)) {
      if (!partial && [
        "platform",
        "label_ar",
        "label_en",
        "url"
      ].includes(field)) {
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

function validateRequest(req, res) {
  if (
    !req.headers["content-type"] ||
    !/^application\/json(?:\s*;|$)/i.test(
      req.headers["content-type"]
    )
  ) {
    sendError(
      res,
      415,
      "Content-Type must be application/json."
    );

    return false;
  }

  let bodySize;

  try {
    bodySize = Buffer.byteLength(
      JSON.stringify(req.body ?? null),
      "utf8"
    );
  } catch {
    sendError(res, 400, "Invalid request body.");
    return false;
  }

  if (bodySize > MAX_BODY_BYTES) {
    sendError(res, 413, "Request body is too large.");
    return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const methods = ["GET", "POST", "PATCH", "DELETE"];

  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) {
    return;
  }

  if (req.method !== "GET") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    if (!validateRequest(req, res)) {
      return;
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
      `;

      const rows = await adminQuery(sql, query);

      return res.status(200).json({
        socialLinks: rows,
        count: rows.length
      });
    }

    if (req.method === "POST") {
      const body = req.body;

      const error = validateBody(body);

      if (error) {
        return sendError(res, 400, error);
      }

      const query = sql`
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
          ${(body.value ?? "").trim()},
          ${body.url.trim()},
          ${(body.icon ?? "").trim()},
          ${body.is_visible ?? true},
          ${body.sort_order ?? 0}
        )
        RETURNING *
      `;

      const rows = await adminQuery(sql, query);

      return res.status(201).json({
        message: "Social link created successfully.",
        socialLink: rows[0]
      });
    }

    if (req.method === "PATCH") {
      const body = req.body;

      if (!isPlainObject(body) || !validId(body.id)) {
        return sendError(res, 400, "Invalid social link ID.");
      }

      const error = validateBody(body, {
        partial: true,
        allowId: true
      });

      if (error) {
        return sendError(res, 400, error);
      }

      const hasUpdates = PATCH_FIELDS.some(
        (field) => Object.hasOwn(body, field)
      );

      if (!hasUpdates) {
        return sendError(res, 400, "No fields to update.");
      }

      const query = sql`
        UPDATE site_social_links
        SET
          platform = COALESCE(
            ${body.platform !== undefined
              ? body.platform.trim()
              : null},
            platform
          ),
          label_ar = COALESCE(
            ${body.label_ar !== undefined
              ? body.label_ar.trim()
              : null},
            label_ar
          ),
          label_en = COALESCE(
            ${body.label_en !== undefined
              ? body.label_en.trim()
              : null},
            label_en
          ),
          value = COALESCE(
            ${body.value !== undefined
              ? body.value.trim()
              : null},
            value
          ),
          url = COALESCE(
            ${body.url !== undefined
              ? body.url.trim()
              : null},
            url
          ),
          icon = COALESCE(
            ${body.icon !== undefined
              ? body.icon.trim()
              : null},
            icon
          ),
          is_visible = COALESCE(
            ${body.is_visible ?? null},
            is_visible
          ),
          sort_order = COALESCE(
            ${body.sort_order ?? null},
            sort_order
          )
        WHERE id = ${Number(body.id)}
        RETURNING *
      `;

      const rows = await adminQuery(sql, query);

      if (!rows.length) {
        return sendError(res, 404, "Social link not found.");
      }

      return res.status(200).json({
        message: "Social link updated successfully.",
        socialLink: rows[0]
      });
    }

    if (req.method === "DELETE") {
      const body = req.body;

      if (
        !isPlainObject(body) ||
        !validId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid social link ID.");
      }

      const query = sql`
        DELETE FROM site_social_links
        WHERE id = ${Number(body.id)}
        RETURNING id
      `;

      const rows = await adminQuery(sql, query);

      if (!rows.length) {
        return sendError(res, 404, "Social link not found.");
      }

      return res.status(200).json({
        message: "Social link deleted successfully.",
        id: rows[0].id
      });
    }
  } catch {
    console.error("[admin-social] Database operation failed.");

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
