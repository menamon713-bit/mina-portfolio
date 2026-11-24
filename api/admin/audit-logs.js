"use strict";

const { neon } = require("@neondatabase/serverless");

const { requireAdmin } = require("../_lib/admin-auth");
const { adminQuery } = require("../_lib/admin-db");

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) return;

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return sendError(res, 503, "Database is unavailable.");
  }

  const rawLimit = Number(req.query?.limit ?? 25);
  const rawOffset = Number(req.query?.offset ?? 0);

  if (
    !Number.isInteger(rawLimit) ||
    rawLimit < 1 ||
    rawLimit > 50 ||
    !Number.isInteger(rawOffset) ||
    rawOffset < 0 ||
    rawOffset > 100000
  ) {
    return sendError(res, 400, "Invalid pagination.");
  }

  try {
    const sql = neon(databaseUrl);

    const rows = await adminQuery(
      sql,
      sql`
        SELECT
          id,
          action,
          entity_type,
          entity_id,
          description,
          created_at
        FROM public.admin_activity_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ${rawLimit}
        OFFSET ${rawOffset}
      `
    );

    const countRows = await adminQuery(
      sql,
      sql`
        SELECT COUNT(*)::int AS total
        FROM public.admin_activity_logs
      `
    );

    return res.status(200).json({
      success: true,
      logs: rows,
      total: countRows[0]?.total ?? 0,
      limit: rawLimit,
      offset: rawOffset
    });
  } catch (error) {
    console.error("[admin-audit-logs] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    return sendError(
      res,
      500,
      "تعذر تحميل سجل النشاط."
    );
  }
};
