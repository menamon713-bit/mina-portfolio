"use strict";

const { requireAdmin } = require("../_lib/admin-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  // لا يُسمح بالتشخيص إلا للأدمن المسجل دخوله.
  if (!(await requireAdmin(req, res))) return;

  // تشخيص مؤقت لاتصال قاعدة البيانات المستخدم من Vercel.
  if (req.query?.diagnostic === "db-role") {
    const databaseUrl = process.env.DATABASE_URL;

    if (
      typeof databaseUrl !== "string" ||
      !databaseUrl.trim()
    ) {
      return res.status(503).json({
        error: "Database connection is unavailable."
      });
    }

    try {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(databaseUrl);

      const result = await sql`
        SELECT
          current_user AS database_user,
          session_user AS session_user,
          current_database() AS database_name
      `;

      return res.status(200).json({
        diagnostic: true,
        database: result[0]
      });
    } catch {
      console.error("[admin-session] Database diagnostic failed.");

      return res.status(503).json({
        error: "Database diagnostic failed."
      });
    }
  }

  // الاستجابة الأصلية المستخدمة بواسطة لوحة الإدارة.
  return res.status(200).json({
    authenticated: true
  });
};
