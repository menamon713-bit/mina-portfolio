"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const ALLOWED_STATUSES = [
  "new",
  "read",
  "replied",
  "archived"
];

function sendError(res, status, message) {
  return res.status(status).json({
    error: message
  });
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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, PATCH");

    return sendError(
      res,
      405,
      "Method not allowed."
    );
  }

  if (!requireAdmin(req, res)) {
    return;
  }

  if (
    req.method === "PATCH" &&
    !checkSameOrigin(req)
  ) {
    return sendError(
      res,
      403,
      "Invalid request origin."
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return sendError(
      res,
      503,
      "Database is unavailable."
    );
  }

  try {
    const sql = neon(databaseUrl);

    if (req.method === "GET") {
      const messages = await sql`
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
      return sendError(
        res,
        400,
        "Invalid message update."
      );
    }

    const rows = await sql`
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

    if (!rows.length) {
      return sendError(
        res,
        404,
        "Message not found."
      );
    }

    return res.status(200).json({
      success: true,
      message: "Message status updated successfully.",
      data: rows[0]
    });

  } catch (error) {
    console.error(
      "Admin messages API error:",
      error
    );

    return sendError(
      res,
      500,
      "An internal server error occurred."
    );
  }
};
