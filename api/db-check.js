const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({
      success: false,
      message: "Database configuration is missing"
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT 1 AS connected`;

    return res.status(200).json({
      success: true,
      database: "connected",
      test: result[0].connected
    });
  } catch (error) {
    return res.status(503).json({
      success: false,
      database: "unavailable",
      message: "Database connection failed"
    });
  }
};
