"use strict";

const { neon } = require("@neondatabase/serverless");
const { requireAdmin } = require("../_lib/admin-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!requireAdmin(req, res)) return;

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return res.status(503).json({
      error: "Database is unavailable."
    });
  }

  try {
    const sql = neon(databaseUrl);

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

  } catch (error) {
    console.error("Admin messages error:", error.message);

    return res.status(500).json({
      error: "Could not load messages."
    });
  }
};
