"use strict";

const { neon } = require("@neondatabase/serverless");

const {
  requireAdmin,
  checkSameOrigin
} = require("../_lib/admin-auth");

const { adminQuery } = require("../_lib/admin-db");
const { writeAuditLog } = require("../_lib/audit-log");

const ALLOWED_KEYS = Object.freeze({
  site_name: "string",
  contact_email: "string",
  maintenance_mode: "boolean"
});

const DEFAULTS = Object.freeze({
  site_name: "M.A.S.H CYVEX",
  contact_email: "",
  maintenance_mode: false
});

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function validateSettings(body) {
  if (!isPlainObject(body)) return "بيانات الإعدادات غير صحيحة.";

  const keys = Object.keys(body);

  if (!keys.length || keys.some((key) => !Object.hasOwn(ALLOWED_KEYS, key))) {
    return "يوجد حقل غير مسموح به.";
  }

  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== ALLOWED_KEYS[key]) {
      return `قيمة غير صحيحة للحقل: ${key}`;
    }

    if (key === "site_name" && (!value.trim() || value.length > 100)) {
      return "اسم الموقع مطلوب وبحد أقصى 100 حرف.";
    }

    if (key === "contact_email") {
      if (
        value.length > 254 ||
        (value !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      ) {
        return "البريد الإلكتروني غير صحيح.";
      }
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    return sendError(res, 405, "Method not allowed.");
  }

  if (!(await requireAdmin(req, res))) return;

  if (req.method === "PUT") {
    if (!checkSameOrigin(req)) {
      return sendError(res, 403, "Invalid request origin.");
    }

    const contentType = req.headers["content-type"] || "";

    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return sendError(res, 415, "Content-Type must be application/json.");
    }

    if (Buffer.byteLength(JSON.stringify(req.body ?? null), "utf8") > 4096) {
      return sendError(res, 413, "Request body is too large.");
    }
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return sendError(res, 503, "Database is unavailable.");
  }

  try {
    const sql = neon(databaseUrl);

    if (req.method === "GET") {
      const rows = await adminQuery(
        sql,
        sql`
          SELECT setting_key, setting_value
          FROM public.site_settings
          WHERE setting_key IN (
            'site_name',
            'contact_email',
            'maintenance_mode'
          )
        `
      );

      const settings = { ...DEFAULTS };

      for (const row of rows) {
        if (!Object.hasOwn(ALLOWED_KEYS, row.setting_key)) continue;

        const value = row.setting_value;

        if (typeof value === ALLOWED_KEYS[row.setting_key]) {
          settings[row.setting_key] = value;
        }
      }

      return res.status(200).json({
        success: true,
        settings
      });
    }

    const error = validateSettings(req.body);

    if (error) return sendError(res, 400, error);

    for (const [key, value] of Object.entries(req.body)) {
      await adminQuery(
        sql,
        sql`
          INSERT INTO public.site_settings (
            setting_key,
            setting_value,
            updated_at
          )
          VALUES (
            ${key},
            ${JSON.stringify(value)}::jsonb,
            NOW()
          )
          ON CONFLICT (setting_key)
          DO UPDATE SET
            setting_value = EXCLUDED.setting_value,
            updated_at = NOW()
        `
      );
    }

    try {
      await writeAuditLog(sql, {
        action: "settings.updated",
        entityType: "site_settings",
        description: "تم تحديث إعدادات الموقع."
      });
    } catch (error) {
      console.error("[admin-settings] Audit log write failed.", {
        code: error?.code || "NO_CODE"
      });

      return sendError(
        res,
        500,
        "تم حفظ الإعدادات، لكن تعذر تسجيل العملية في سجل النشاط. أعد تحميل الإعدادات للتحقق."
      );
    }

    return res.status(200).json({
      success: true,
      message: "تم حفظ الإعدادات."
    });
  } catch (error) {
    console.error("[admin-settings] Database operation failed.", {
      code: error?.code || "NO_CODE"
    });

    return sendError(
      res,
      500,
      "حدث خطأ أثناء التعامل مع الإعدادات."
    );
  }
};
