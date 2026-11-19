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

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!checkSameOrigin(req)) {
    return res.status(403).json({
      error: "Forbidden origin."
    });
  }

  if (!requireAdmin(req, res)) return;

  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return res.status(400).json({
      error: "Invalid request."
    });
  }

  const id = Number(body.id);
  const status = body.status;

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !ALLOWED_STATUSES.includes(status)
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
      SET status = ${status}
      WHERE id = ${id}
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

  } catch (error) {
    console.error("Admin status update error:", error.message);

    return res.status(500).json({
      error: "Could not update message status."
    });
  }
};
