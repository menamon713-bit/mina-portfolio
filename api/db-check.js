"use strict";

const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (typeof databaseUrl !== "string" || !databaseUrl) {
    return res.status(503).json({
      success: false,
      message: "Service unavailable."
    });
  }

  try {
    const sql = neon(databaseUrl);
    await sql`SELECT 1`;

    return res.status(200).json({
      success: true,
      database: "available"
    });
  } catch (error) {
    console.error("Database health check failed.");

    return res.status(503).json({
      success: false,
      database: "unavailable"
    });
  }
};
