"use strict";

const { neon } = require("@neondatabase/serverless");
const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const sql = neon(process.env.DATABASE_URL);

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

  const stringFields = {
    name_ar: 150,
    name_en: 150,
    icon: 100,
    category: 100
  };

  for (const [field, max] of Object.entries(stringFields)) {
    if (!Object.hasOwn(body, field)) {
      if (!partial && (field === "name_ar" || field === "name_en")) {
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

  if (
    Object.hasOwn(body, "progress") &&
    (!Number.isInteger(body.progress) ||
      body.progress < 0 ||
      body.progress > 100)
  ) {
    return "Progress must be an integer between 0 and 100.";
  }

  if (
    Object.hasOwn(body, "sort_order") &&
    !Number.isInteger(body.sort_order)
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
    // GET: List skills
    if (req.method === "GET") {
      const rows = await sql`
        SELECT *
        FROM site_skills
        ORDER BY sort_order ASC, id ASC
      `;

      return res.status(200).json({
        skills: rows,
        count: rows.length
      });
    }

    // POST: Create skill
    if (req.method === "POST") {
      const body = req.body;
      const error = validateBody(body);

      if (error) return sendError(res, 400, error);

      const rows = await sql`
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
          ${body.name_ar.trim()},
          ${body.name_en.trim()},
          ${body.icon?.trim() ?? ""},
          ${body.progress ?? 0},
          ${body.category?.trim() ?? ""},
          ${body.is_visible ?? true},
          ${body.sort_order ?? 0}
        )
        RETURNING *
      `;

      return res.status(201).json({
        message: "Skill created successfully.",
        skill: rows[0]
      });
    }

    // PATCH: Update skill
    if (req.method === "PATCH") {
      const body = req.body;

      if (!validId(body?.id)) {
        return sendError(res, 400, "Invalid skill ID.");
      }

      const error = validateBody(body, true);
      if (error) return sendError(res, 400, error);

      const allowedFields = [
        "name_ar",
        "name_en",
        "icon",
        "progress",
        "category",
        "is_visible",
        "sort_order"
      ];

      if (!allowedFields.some((field) => Object.hasOwn(body, field))) {
        return sendError(res, 400, "No fields to update.");
      }

      const rows = await sql`
        UPDATE site_skills
        SET
          name_ar = COALESCE(${body.name_ar?.trim() ?? null}, name_ar),
          name_en = COALESCE(${body.name_en?.trim() ?? null}, name_en),
          icon = COALESCE(${body.icon?.trim() ?? null}, icon),
          progress = COALESCE(${body.progress ?? null}, progress),
          category = COALESCE(${body.category?.trim() ?? null}, category),
          is_visible = COALESCE(${body.is_visible ?? null}, is_visible),
          sort_order = COALESCE(${body.sort_order ?? null}, sort_order),
          updated_at = NOW()
        WHERE id = ${Number(body.id)}
        RETURNING *
      `;

      if (!rows.length) {
        return sendError(res, 404, "Skill not found.");
      }

      return res.status(200).json({
        message: "Skill updated successfully.",
        skill: rows[0]
      });
    }

    // DELETE: Delete skill
    if (req.method === "DELETE") {
      const id = req.body?.id;

      if (!validId(id)) {
        return sendError(res, 400, "Invalid skill ID.");
      }

      const rows = await sql`
        DELETE FROM site_skills
        WHERE id = ${Number(id)}
        RETURNING id
      `;

      if (!rows.length) {
        return sendError(res, 404, "Skill not found.");
      }

      return res.status(200).json({
        message: "Skill deleted successfully.",
        id: rows[0].id
      });
    }

  } catch (error) {
    console.error("Admin skills API error:", error);

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
