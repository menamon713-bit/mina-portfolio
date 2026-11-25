"use strict";

const { adminQuery } = require("./_lib/admin-db");

const ALLOWED_WHATSAPP_APPS = Object.freeze({
  business: "com.whatsapp.w4b",
  messenger: "com.whatsapp"
});

const CACHE_PUBLIC =
  "public, s-maxage=60, stale-while-revalidate=300";

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store");

  return res.status(status).json({
    success: false,
    message
  });
}

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  return value.trim();
}

function getSqlClient(databaseUrl) {
  const { neon } = require("@neondatabase/serverless");
  return neon(databaseUrl);
}

async function isMaintenanceEnabled(sql) {
  const rows = await adminQuery(
    sql,
    sql`
      SELECT setting_value
      FROM public.site_settings
      WHERE setting_key = 'maintenance_mode'
      LIMIT 1
    `
  );

  return rows[0]?.setting_value === true;
}

async function getSiteData(sql) {
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
        site_seo.page_slug,
        site_seo.title_ar,
        site_seo.title_en,
        site_seo.description_ar,
        site_seo.description_en,
        site_seo.keywords_ar,
        site_seo.keywords_en,
        site_seo.og_image,
        site_seo.canonical_url
      FROM site_seo
      INNER JOIN site_pages
        ON site_pages.slug = site_seo.page_slug
      WHERE site_pages.is_published = TRUE
      ORDER BY site_seo.page_slug ASC
    `
  ]);

  return {
    profile: profile[0] || null,
    skills,
    socialLinks,
    content,
    pages,
    seo
  };
}

async function getProjects(sql) {
  return sql`
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
}

function handleWhatsApp(req, res) {
  const app = req.query?.app;

  if (!app) {
    return res.status(200).json({
      success: true,
      status: "online"
    });
  }

  if (
    typeof app !== "string" ||
    !Object.prototype.hasOwnProperty.call(
      ALLOWED_WHATSAPP_APPS,
      app
    )
  ) {
    return sendError(
      res,
      400,
      "Invalid WhatsApp application."
    );
  }

  const phone = process.env.WHATSAPP_PHONE;

  if (
    typeof phone !== "string" ||
    !/^[1-9]\d{7,14}$/.test(phone)
  ) {
    return sendError(
      res,
      503,
      "WhatsApp is currently unavailable."
    );
  }

  const packageName = ALLOWED_WHATSAPP_APPS[app];
  const fallbackUrl = `https://wa.me/${phone}`;

  const intentUrl =
    `intent://send?phone=${phone}` +
    `#Intent;scheme=whatsapp;` +
    `package=${packageName};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;

  return res.redirect(302, intentUrl);
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return sendError(
      res,
      405,
      "Method not allowed."
    );
  }

  const resource = req.query?.resource;

  if (
    resource !== undefined &&
    resource !== "site-data" &&
    resource !== "projects"
  ) {
    return sendError(
      res,
      400,
      "Invalid resource."
    );
  }

  // Public website data and maintenance status
  if (resource === "site-data") {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
      return sendError(
        res,
        503,
        "Website data is currently unavailable."
      );
    }

    try {
      const sql = getSqlClient(databaseUrl);
      const maintenanceMode = await isMaintenanceEnabled(sql);

      if (maintenanceMode) {
        res.setHeader("Cache-Control", "no-store");

        return res.status(200).json({
          success: true,
          maintenanceMode: true
        });
      }

      const data = await getSiteData(sql);

      // Cache only public website content.
      // Never cache admin responses or maintenance state.
      res.setHeader("Cache-Control", CACHE_PUBLIC);

      return res.status(200).json({
        success: true,
        maintenanceMode: false,
        data
      });
    } catch (error) {
      console.error("Public site data error:", error);

      return sendError(
        res,
        503,
        "Website data is currently unavailable."
      );
    }
  }

  // Public projects
  if (resource === "projects") {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
      return sendError(
        res,
        503,
        "Projects are currently unavailable."
      );
    }

    try {
      const sql = getSqlClient(databaseUrl);
      const projects = await getProjects(sql);

      res.setHeader("Cache-Control", CACHE_PUBLIC);

      return res.status(200).json({
        success: true,
        projects,
        count: projects.length
      });
    } catch (error) {
      console.error("Public projects error:", error);

      return sendError(
        res,
        503,
        "Projects are currently unavailable."
      );
    }
  }

  // Health check and WhatsApp redirect
  res.setHeader("Cache-Control", "no-store");

  return handleWhatsApp(req, res);
};
