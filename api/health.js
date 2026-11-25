"use strict";

const { neon } = require("@neondatabase/serverless");
const { adminQuery } = require("./_lib/admin-db");
const { getClientKey } = require("./_lib/client-ip");
const { consume } = require("./_lib/rate-limit");

const ALLOWED_WHATSAPP_APPS = Object.freeze({
  business: "com.whatsapp.w4b",
  messenger: "com.whatsapp"
});

const RATE_LIMIT = 120;
const RATE_WINDOW = 60;

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json({ success: false, message });
}

async function enforceRateLimit(req, res) {
  const clientKey = getClientKey(req);

  if (!clientKey) {
    sendError(res, 400, "Invalid client address.");
    return false;
  }

  try {
    const result = await consume(
      `mash:public-api:${clientKey}`,
      RATE_WINDOW,
      RATE_LIMIT
    );

    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfter));
      sendError(res, 429, "Too many requests. Please try again later.");
      return false;
    }

    return true;
  } catch {
    console.error("[health] Rate limit service unavailable.");
    sendError(res, 503, "Service temporarily unavailable.");
    return false;
  }
}

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

async function isMaintenanceEnabled(sql) {
  const rows = await adminQuery(sql, sql`
    SELECT setting_value
    FROM public.site_settings
    WHERE setting_key = 'maintenance_mode'
    LIMIT 1
  `);

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
        full_name, job_title, short_bio,
        about, location, profile_image
      FROM public.site_profile
      ORDER BY id ASC
      LIMIT 1
    `,
    sql`
      SELECT
        id, name_ar, name_en, icon,
        progress, category, sort_order
      FROM public.site_skills
      WHERE is_visible = TRUE
      ORDER BY sort_order ASC, id ASC
    `,
    sql`
      SELECT
        id, platform, label_ar, label_en,
        value, url, icon, sort_order
      FROM public.site_social_links
      WHERE is_visible = TRUE
      ORDER BY sort_order ASC, id ASC
    `,
    sql`
      SELECT
        content_key, section, title_ar, title_en,
        content_ar, content_en, sort_order
      FROM public.site_content
      WHERE is_visible = TRUE
      ORDER BY sort_order ASC, id ASC
    `,
    sql`
      SELECT
        slug, title_ar, title_en, content_ar, content_en
      FROM public.site_pages
      WHERE is_published = TRUE
      ORDER BY slug ASC
    `,
    sql`
      SELECT
        seo.page_slug,
        seo.title_ar,
        seo.title_en,
        seo.description_ar,
        seo.description_en,
        seo.keywords_ar,
        seo.keywords_en,
        seo.og_image,
        seo.canonical_url
      FROM public.site_seo AS seo
      INNER JOIN public.site_pages AS pages
        ON pages.slug = seo.page_slug
      WHERE pages.is_published = TRUE
      ORDER BY seo.page_slug ASC
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
    FROM public.site_projects
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
    !Object.prototype.hasOwnProperty.call(ALLOWED_WHATSAPP_APPS, app)
  ) {
    return sendError(res, 400, "Invalid WhatsApp application.");
  }

  const phone = process.env.WHATSAPP_PHONE;

  if (
    typeof phone !== "string" ||
    !/^[1-9]\d{7,14}$/.test(phone)
  ) {
    return sendError(res, 503, "WhatsApp is currently unavailable.");
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
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await enforceRateLimit(req, res))) return;

  const resource = req.query?.resource;

  if (
    resource !== undefined &&
    resource !== "site-data" &&
    resource !== "projects"
  ) {
    return sendError(res, 400, "Invalid resource.");
  }

  if (resource === "site-data" || resource === "projects") {
    const databaseUrl = getDatabaseUrl();

    if (!databaseUrl) {
      return sendError(res, 503, "Website data is currently unavailable.");
    }

    try {
      const sql = neon(databaseUrl);

      if (resource === "site-data") {
        const maintenanceMode = await isMaintenanceEnabled(sql);

        if (maintenanceMode) {
          return res.status(200).json({
            success: true,
            maintenanceMode: true
          });
        }

        const data = await getSiteData(sql);

        return res.status(200).json({
          success: true,
          maintenanceMode: false,
          data
        });
      }

      const projects = await getProjects(sql);

      return res.status(200).json({
        success: true,
        projects,
        count: projects.length
      });
    } catch (error) {
      console.error("[health] Public query failed.", {
        name: error?.name || "UnknownError",
        code: error?.code || "NO_CODE"
      });

      return sendError(
        res,
        503,
        resource === "site-data"
          ? "Website data is currently unavailable."
          : "Projects are currently unavailable."
      );
    }
  }

  return handleWhatsApp(req, res);
};
