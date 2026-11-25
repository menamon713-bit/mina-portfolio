"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");
const { guardAdminWrite } = require("../_lib/audit-log");

const MAX_BODY_BYTES = 64 * 1024;

const STRING_FIELDS = {
  title_ar: 200,
  title_en: 200,
  description_ar: 20000,
  description_en: 20000,
  category_ar: 100,
  category_en: 100,
  image_url: 2000,
  visual_style: 100,
  live_url: 2000,
  github_url: 2000
};

const JSON_FIELDS = ["details_ar", "details_en"];

const ALLOWED_FIELDS = [
  ...Object.keys(STRING_FIELDS),
  ...JSON_FIELDS,
  "details_type",
  "is_visible",
  "sort_order"
];

const CREATE_REQUIRED = [
  "title_ar",
  "title_en",
  "details_ar",
  "details_en"
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

function validHttpsUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string") return false;

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

function validImageUrl(value) {
  if (value === "") return true;
  if (typeof value !== "string") return false;

  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u0020]/.test(value)
  ) {
    return true;
  }

  return validHttpsUrl(value);
}

function isSafeJsonObject(value) {
  if (!isPlainObject(value)) return false;

  try {
    const serialized = JSON.stringify(value);

    return (
      typeof serialized === "string" &&
      Buffer.byteLength(serialized, "utf8") <= 50000
    );
  } catch {
    return false;
  }
}

function validateBody(body, options = {}) {
  const { partial = false, allowId = false } = options;

  if (!isPlainObject(body)) return "Invalid request body.";

  const allowed = allowId
    ? [...ALLOWED_FIELDS, "id"]
    : ALLOWED_FIELDS;

  for (const field of Object.keys(body)) {
    if (!allowed.includes(field)) return "Unknown field.";
  }

  if (!partial) {
    for (const field of CREATE_REQUIRED) {
      if (!Object.hasOwn(body, field)) {
        return "Missing required field.";
      }
    }
  }

  for (const [field, maxLength] of Object.entries(STRING_FIELDS)) {
    if (!Object.hasOwn(body, field)) continue;

    const value = body[field];

    if (
      typeof value !== "string" ||
      value.length > maxLength
    ) {
      return `Invalid field: ${field}`;
    }

    if (
      ["title_ar", "title_en"].includes(field) &&
      !value.trim()
    ) {
      return `Invalid field: ${field}`;
    }
  }

  for (const field of JSON_FIELDS) {
    if (
      Object.hasOwn(body, field) &&
      !isSafeJsonObject(body[field])
    ) {
      return `Invalid field: ${field}`;
    }
  }

  if (
    Object.hasOwn(body, "details_type") &&
    !["none", "modal", "external"].includes(body.details_type)
  ) {
    return "Invalid details_type.";
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

  for (const field of ["live_url", "github_url"]) {
    if (
      Object.hasOwn(body, field) &&
      !validHttpsUrl(body[field])
    ) {
      return `Invalid ${field}.`;
    }
  }

  if (
    Object.hasOwn(body, "image_url") &&
    !validImageUrl(body.image_url)
  ) {
    return "Invalid image_url.";
  }

  return null;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function auditCountIsValid(rows) {
  return (
    Array.isArray(rows) &&
    rows.length === 1 &&
    Number(rows[0].audit_count) === 1
  );
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

  let body = null;

  if (req.method !== "GET") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    if (!(await guardAdminWrite(req, res, {
      namespace: "projects",
      maxBodyBytes: MAX_BODY_BYTES
    }))) return;

    body = req.body;
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
          p.*,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', t.id,
                  'tag_name', t.tag_name,
                  'sort_order', t.sort_order
                )
                ORDER BY t.sort_order, t.id
              )
              FROM site_project_tags t
              WHERE t.project_id = p.id
            ),
            '[]'::json
          ) AS tags
        FROM site_projects p
        ORDER BY p.sort_order ASC, p.id ASC
      `);

      return res.status(200).json({
        projects: rows,
        count: rows.length
      });
    }

    if (req.method === "POST") {
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await adminQuery(sql, sql`
        WITH changed AS (
          INSERT INTO site_projects (
            title_ar,
            title_en,
            description_ar,
            description_en,
            category_ar,
            category_en,
            image_url,
            visual_style,
            live_url,
            github_url,
            details_type,
            details_ar,
            details_en,
            is_visible,
            sort_order
          )
          VALUES (
            ${body.title_ar.trim()},
            ${body.title_en.trim()},
            ${body.description_ar ?? ""},
            ${body.description_en ?? ""},
            ${body.category_ar ?? ""},
            ${body.category_en ?? ""},
            ${body.image_url ?? ""},
            ${body.visual_style ?? ""},
            ${body.live_url ?? ""},
            ${body.github_url ?? ""},
            ${body.details_type ?? "none"},
            ${JSON.stringify(body.details_ar)},
            ${JSON.stringify(body.details_en)},
            ${body.is_visible ?? true},
            ${body.sort_order ?? 0}
          )
          RETURNING *
        ),
        audit AS (
          INSERT INTO public.admin_activity_logs (
            action,
            entity_type,
            entity_id,
            description
          )
          SELECT
            'project.created',
            'site_projects',
            id,
            'Created a project.'
          FROM changed
          RETURNING id
        )
        SELECT
          changed.*,
          (SELECT COUNT(*) FROM audit)::integer AS audit_count
        FROM changed
      `);

      if (!auditCountIsValid(rows)) {
        throw new Error("PROJECT_CREATE_AUDIT_FAILED");
      }

      const { audit_count, ...project } = rows[0];

      return res.status(201).json({
        message: "Project created successfully.",
        project
      });
    }

    if (req.method === "PATCH") {
      if (!isPlainObject(body) || !validId(body.id)) {
        return sendError(res, 400, "Invalid project ID.");
      }

      const error = validateBody(body, {
        partial: true,
        allowId: true
      });

      if (error) return sendError(res, 400, error);

      const hasUpdates = ALLOWED_FIELDS.some(
        field => Object.hasOwn(body, field)
      );

      if (!hasUpdates) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await adminQuery(sql, sql`
        WITH changed AS (
          UPDATE site_projects
          SET
            title_ar = COALESCE(${body.title_ar === undefined ? null : body.title_ar.trim()}, title_ar),
            title_en = COALESCE(${body.title_en === undefined ? null : body.title_en.trim()}, title_en),
            description_ar = COALESCE(${body.description_ar ?? null}, description_ar),
            description_en = COALESCE(${body.description_en ?? null}, description_en),
            category_ar = COALESCE(${body.category_ar ?? null}, category_ar),
            category_en = COALESCE(${body.category_en ?? null}, category_en),
            image_url = COALESCE(${body.image_url ?? null}, image_url),
            visual_style = COALESCE(${body.visual_style ?? null}, visual_style),
            live_url = COALESCE(${body.live_url ?? null}, live_url),
            github_url = COALESCE(${body.github_url ?? null}, github_url),
            details_type = COALESCE(${body.details_type ?? null}, details_type),
            details_ar = COALESCE(${body.details_ar === undefined ? null : JSON.stringify(body.details_ar)}, details_ar),
            details_en = COALESCE(${body.details_en === undefined ? null : JSON.stringify(body.details_en)}, details_en),
            is_visible = COALESCE(${body.is_visible ?? null}, is_visible),
            sort_order = COALESCE(${body.sort_order ?? null}, sort_order),
            updated_at = NOW()
          WHERE id = ${Number(body.id)}
          RETURNING *
        ),
        audit AS (
          INSERT INTO public.admin_activity_logs (
            action,
            entity_type,
            entity_id,
            description
          )
          SELECT
            'project.updated',
            'site_projects',
            id,
            'Updated a project.'
          FROM changed
          RETURNING id
        )
        SELECT
          changed.*,
          (SELECT COUNT(*) FROM audit)::integer AS audit_count
        FROM changed
      `);

      if (!rows.length) {
        return sendError(res, 404, "Project not found.");
      }

      if (!auditCountIsValid(rows)) {
        throw new Error("PROJECT_UPDATE_AUDIT_FAILED");
      }

      const { audit_count, ...project } = rows[0];

      return res.status(200).json({
        message: "Project updated successfully.",
        project
      });
    }

    if (req.method === "DELETE") {
      if (
        !isPlainObject(body) ||
        !validId(body.id) ||
        Object.keys(body).length !== 1
      ) {
        return sendError(res, 400, "Invalid project ID.");
      }

      const rows = await adminQuery(sql, sql`
        WITH changed AS (
          DELETE FROM site_projects
          WHERE id = ${Number(body.id)}
          RETURNING id
        ),
        audit AS (
          INSERT INTO public.admin_activity_logs (
            action,
            entity_type,
            entity_id,
            description
          )
          SELECT
            'project.deleted',
            'site_projects',
            id,
            'Deleted a project.'
          FROM changed
          RETURNING id
        )
        SELECT
          changed.id,
          (SELECT COUNT(*) FROM audit)::integer AS audit_count
        FROM changed
      `);

      if (!rows.length) {
        return sendError(res, 404, "Project not found.");
      }

      if (!auditCountIsValid(rows)) {
        throw new Error("PROJECT_DELETE_AUDIT_FAILED");
      }

      return res.status(200).json({
        message: "Project deleted successfully.",
        id: rows[0].id
      });
    }
  } catch (error) {
    console.error("[admin-projects] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    if (error?.code === "23505") {
      return sendError(res, 409, "A project with this key already exists.");
    }

    return sendError(res, 500, "An internal server error occurred.");
  }
};
