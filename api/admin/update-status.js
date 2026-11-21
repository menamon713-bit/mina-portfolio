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

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!requireAdmin(req, res)) return;

  if (!checkSameOrigin(req)) {
    return res.status(403).json({
      error: "Forbidden origin."
    });
  }

  const body = req.body;

  if (
    !isPlainObject(body) ||
    Object.keys(body).length !== 2 ||
    !Object.hasOwn(body, "id") ||
    !Object.hasOwn(body, "status") ||
    !validId(body.id) ||
    typeof body.status !== "string" ||
    !ALLOWED_STATUSES.includes(body.status)
  ) {
    return res.status(400).json({
      error: "Invalid message ID or status."
    });
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(503).json({
      error: "Database is unavailable."
    });
  }

  try {
    const sql = neon(databaseUrl);

    const result = await sql`
      UPDATE contact_messages
      SET status = ${body.status}
      WHERE id = ${Number(body.id)}
      RETURNING id, status
    `;

    if (!result.length) {
      return res.status(404).json({
        error: "Message not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: result[0]
    });
  } catch {
    console.error("[admin-status] Database update failed.");

    return res.status(500).json({
      error: "Could not update message status."
    });
  }
};
