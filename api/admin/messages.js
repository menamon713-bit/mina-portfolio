"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");

const MAX_BODY_BYTES = 8 * 1024;

const ALLOWED_STATUSES = [
  "new",
  "read",
  "replied",
  "archived"
];

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

function validateRequestBody(req, res) {
  const contentType = req.headers["content-type"] || "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    sendError(
      res,
      415,
      "Content-Type must be application/json."
    );

    return false;
  }

  let serialized;

  try {
    serialized = JSON.stringify(req.body ?? null);
  } catch {
    sendError(res, 400, "Invalid request body.");
    return false;
  }

  if (typeof serialized !== "string") {
    sendError(res, 400, "Invalid request body.");
    return false;
  }

  const bodySize = Buffer.byteLength(serialized, "utf8");

  if (bodySize > MAX_BODY_BYTES) {
    sendError(res, 413, "Request body is too large.");
    return false;
  }

  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) return;

  if (req.method === "PATCH") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    if (!validateRequestBody(req, res)) {
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
          name,
          email,
          subject,
          message,
          status,
          created_at
        FROM contact_messages
        ORDER BY created_at DESC
        LIMIT 100
      `;

      const messages = await adminQuery(sql, query);

      return res.status(200).json({
        success: true,
        messages
      });
    }

    const body = req.body;

    if (
      !isPlainObject(body) ||
      !validId(body.id) ||
      typeof body.status !== "string" ||
      !ALLOWED_STATUSES.includes(body.status) ||
      Object.keys(body).length !== 2
    ) {
      return sendError(res, 400, "Invalid message update.");
    }

    const query = sql`
      UPDATE contact_messages
      SET status = ${body.status}
      WHERE id = ${Number(body.id)}
      RETURNING
        id,
        name,
        email,
        subject,
        message,
        status,
        created_at
    `;

    const rows = await adminQuery(sql, query);

    if (!rows.length) {
      return sendError(res, 404, "Message not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Message status updated successfully.",
      data: rows[0]
    });
  } catch (error) {
    console.error("[admin-messages] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
