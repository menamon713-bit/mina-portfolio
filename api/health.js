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

  // Public website data
  if (resource === "site-data") {
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
        message: "Website data is currently unavailable."
      });
    }

    try {
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(databaseUrl);

      const [
        profile,
        skills,
        socialLinks,
        content,
        pages,
        seo
      ] = await Promise.all([
        sql`
          SELECT
            full_name,
            job_title,
            short_bio,
            about,
            location,
            profile_image
          FROM site_profile
          ORDER BY id ASC
          LIMIT 1
        `,

        sql`
          SELECT
            id,
            name_ar,
            name_en,
            icon,
            progress,
            category,
            sort_order
          FROM site_skills
          WHERE is_visible = TRUE
          ORDER BY sort_order ASC, id ASC
        `,

        sql`
          SELECT
            id,
            platform,
            label_ar,
            label_en,
            value,
            url,
            icon,
            sort_order
          FROM site_social_links
          WHERE is_visible = TRUE
          ORDER BY sort_order ASC, id ASC
        `,

        sql`
          SELECT
            content_key,
            section,
            title_ar,
            title_en,
            content_ar,
            content_en,
            sort_order
          FROM site_content
          WHERE is_visible = TRUE
          ORDER BY sort_order ASC, id ASC
        `,

        sql`
          SELECT
            slug,
            title_ar,
            title_en,
            content_ar,
            content_en
          FROM site_pages
          WHERE is_published = TRUE
          ORDER BY slug ASC
        `,

        sql`
          SELECT
            page_slug,
            title_ar,
            title_en,
            description_ar,
            description_en,
            keywords_ar,
            keywords_en,
            og_image,
            canonical_url
          FROM site_seo
          ORDER BY page_slug ASC
        `
      ]);

      return res.status(200).json({
        success: true,
        data: {
          profile: profile[0] || null,
          skills,
          socialLinks,
          content,
          pages,
          seo
        }
      });

    } catch (error) {
      console.error("Public site data error:", error);

      return res.status(503).json({
        success: false,
        message: "Website data is currently unavailable."
      });
    }
  }

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
