"use strict";

const { neon } = require("@neondatabase/serverless");
const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const sql = neon(process.env.DATABASE_URL);

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

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function validId(value) {
  return (
    (typeof value === "string" || typeof value === "number") &&
    /^\d+$/.test(String(value)) &&
    Number(value) > 0
  );
}

function validateBody(body, partial = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "Invalid request body.";
  }

  for (const [field, max] of Object.entries(STRING_FIELDS)) {
    if (!Object.hasOwn(body, field)) {
      if (
        !partial &&
        ["title_ar", "title_en"].includes(field)
      ) {
        return `Missing field: ${field}`;
      }
      continue;
    }

    if (
      typeof body[field] !== "string" ||
      body[field].length > max
    ) {
      return `Invalid field: ${field}`;
    }
  }

  for (const field of JSON_FIELDS) {
    if (!Object.hasOwn(body, field)) {
      if (!partial) {
        return `Missing field: ${field}`;
      }
      continue;
    }

    const value = body[field];

    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return `Invalid field: ${field}`;
    }

    try {
      if (JSON.stringify(value).length > 50000) {
        return `${field} is too large.`;
      }
    } catch (_) {
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
    !Number.isInteger(body.sort_order)
  ) {
    return "Invalid sort_order.";
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const methods = ["GET", "POST", "PATCH", "DELETE"];

  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    return sendError(res, 405, "Method not allowed.");
  }

  if (!requireAdmin(req, res)) return;

  if (req.method !== "GET" && !checkSameOrigin(req)) {
    return sendError(res, 403, "Invalid request origin.");
  }

  try {
    // GET: List projects with tags
    if (req.method === "GET") {
      const rows = await sql`
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
      `;

      return res.status(200).json({
        projects: rows,
        count: rows.length
      });
    }

    // POST: Create project
    if (req.method === "POST") {
      const body = req.body;
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await sql`
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
      `;

      return res.status(201).json({
        message: "Project created successfully.",
        project: rows[0]
      });
    }

    // PATCH: Update project
    if (req.method === "PATCH") {
      const body = req.body;

      if (!validId(body?.id)) {
        return sendError(res, 400, "Invalid project ID.");
      }

      const error = validateBody(body, true);
      if (error) return sendError(res, 400, error);

      const allowedFields = [
        ...Object.keys(STRING_FIELDS),
        ...JSON_FIELDS,
        "details_type",
        "is_visible",
        "sort_order"
      ];

      if (!allowedFields.some((field) => Object.hasOwn(body, field))) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await sql`
        UPDATE site_projects
        SET
          title_ar = COALESCE(${body.title_ar?.trim() ?? null}, title_ar),
          title_en = COALESCE(${body.title_en?.trim() ?? null}, title_en),
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
      `;

      if (!rows.length) {
        return sendError(res, 404, "Project not found.");
      }

      return res.status(200).json({
        message: "Project updated successfully.",
        project: rows[0]
      });
    }

    // DELETE: Delete project
    if (req.method === "DELETE") {
      const id = req.body?.id;

      if (!validId(id)) {
        return sendError(res, 400, "Invalid project ID.");
      }

      const rows = await sql`
        DELETE FROM site_projects
        WHERE id = ${Number(id)}
        RETURNING id
      `;

      if (!rows.length) {
        return sendError(res, 404, "Project not found.");
      }

      return res.status(200).json({
        message: "Project deleted successfully.",
        id: rows[0].id
      });
    }

  } catch (error) {
    console.error("Admin projects API error:", error);

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
