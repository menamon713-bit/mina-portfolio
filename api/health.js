"use strict";

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const resource = req.query?.resource;

  // Public projects endpoint
  if (resource === "projects") {
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=60, stale-while-revalidate=300"
    );

    const databaseUrl = process.env.DATABASE_URL;

    if (
      typeof databaseUrl !== "string" ||
      !databaseUrl.trim()
    ) {
      return res.status(503).json({
        success: false,
        message: "Projects are currently unavailable."
      });
    }

    try {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(databaseUrl);

      const projects = await sql`
        SELECT
          id,
          title_ar,
          title_en,
          description_ar,
          description_en,
          category_ar,
          category_en,
          image_url,
          live_url,
          github_url,
          details_type,
          details_ar,
          details_en,
          visual_style,
          sort_order
        FROM site_projects
        WHERE is_visible = TRUE
        ORDER BY sort_order ASC, id ASC
      `;

      return res.status(200).json({
        success: true,
        projects,
        count: projects.length
      });

    } catch (error) {
      console.error("Public projects error:", error);

      return res.status(503).json({
        success: false,
        message: "Projects are currently unavailable."
      });
    }
  }

  // Reject unknown resources
  if (resource !== undefined) {
    res.setHeader("Cache-Control", "no-store");

    return res.status(400).json({
      success: false,
      message: "Invalid resource."
    });
  }

  res.setHeader("Cache-Control", "no-store");

  const app = req.query?.app;

  // Normal health check
  if (!app) {
    return res.status(200).json({
      success: true,
      status: "online"
    });
  }

  // WhatsApp application handling
  const packages = {
    business: "com.whatsapp.w4b",
    messenger: "com.whatsapp"
  };

  if (!Object.prototype.hasOwnProperty.call(packages, app)) {
    return res.status(400).json({
      success: false,
      message: "Invalid WhatsApp application."
    });
  }

  const phone = process.env.WHATSAPP_PHONE;

  if (
    typeof phone !== "string" ||
    !/^[1-9]\d{7,14}$/.test(phone)
  ) {
    return res.status(503).json({
      success: false,
      message: "WhatsApp is currently unavailable."
    });
  }

  const fallback = `https://wa.me/${phone}`;

  const intent =
    `intent://send?phone=${phone}` +
    `#Intent;scheme=whatsapp;` +
    `package=${packages[app]};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;

  return res.redirect(302, intent);
};
