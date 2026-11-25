"use strict";

const crypto = require("crypto");
const { getCookie } = require("./admin-auth");
const { consume } = require("./rate-limit");

const ALLOWED_ACTIONS = new Set([
  "settings.updated",
  "project.created",
  "project.updated",
  "project.deleted"
]);

const ALLOWED_ENTITIES = new Set([
  "site_settings",
  "site_projects"
]);

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW = 600;

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sendError(res, status, message) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(status).json({ error: message });
}

function getRateLimitKey(req, namespace) {
  const token = getCookie(req);

  if (typeof token !== "string" || !token) {
    throw new Error("RATE_LIMIT_SESSION_MISSING");
  }

  const digest = crypto
    .createHash("sha256")
    .update(token, "utf8")
    .digest("hex");

  return `mash:admin-write:${namespace}:${digest}`;
}

async function guardAdminWrite(req, res, options = {}) {
  const {
    namespace = "general",
    maxBodyBytes = 16 * 1024,
    limit = DEFAULT_LIMIT,
    windowSeconds = DEFAULT_WINDOW
  } = options;

  if (
    typeof namespace !== "string" ||
    !/^[a-zA-Z0-9_-]{1,40}$/.test(namespace) ||
    !Number.isSafeInteger(maxBodyBytes) ||
    maxBodyBytes < 1 ||
    maxBodyBytes > 1024 * 1024
  ) {
    sendError(res, 500, "Invalid security configuration.");
    return false;
  }

  const contentType = req.headers?.["content-type"];

  if (
    typeof contentType !== "string" ||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType.trim())
  ) {
    sendError(res, 415, "Content-Type must be application/json.");
    return false;
  }

  const rawLength = req.headers?.["content-length"];

  if (rawLength !== undefined) {
    if (
      typeof rawLength !== "string" ||
      !/^\d+$/.test(rawLength) ||
      !Number.isSafeInteger(Number(rawLength)) ||
      Number(rawLength) > maxBodyBytes
    ) {
      sendError(res, 413, "Request body is too large.");
      return false;
    }
  }

  let serialized;

  try {
    serialized = JSON.stringify(req.body ?? null);
  } catch {
    sendError(res, 400, "Invalid request body.");
    return false;
  }

  if (
    typeof serialized !== "string" ||
    Buffer.byteLength(serialized, "utf8") > maxBodyBytes
  ) {
    sendError(res, 413, "Request body is too large.");
    return false;
  }

  let result;

  try {
    result = await consume(
      getRateLimitKey(req, namespace),
      windowSeconds,
      limit
    );
  } catch {
    console.error("[admin-write] Rate limit service unavailable.");
    sendError(res, 503, "Security service temporarily unavailable.");
    return false;
  }

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfter));
    sendError(res, 429, "Too many requests. Please try again later.");
    return false;
  }

  return true;
}

async function writeAuditLog(sql, {
  action,
  entityType,
  description,
  entityId = null
}) {
  if (
    !ALLOWED_ACTIONS.has(action) ||
    !ALLOWED_ENTITIES.has(entityType) ||
    typeof description !== "string" ||
    description.length < 1 ||
    description.length > 300 ||
    (
      entityId !== null &&
      (
        !Number.isSafeInteger(Number(entityId)) ||
        Number(entityId) < 1
      )
    )
  ) {
    throw new Error("INVALID_AUDIT_LOG");
  }

  const query = sql`
    INSERT INTO public.admin_activity_logs (
      action,
      entity_type,
      entity_id,
      description
    )
    VALUES (
      ${action},
      ${entityType},
      ${entityId},
      ${description}
    )
    RETURNING id
  `;

  const { adminQuery } = require("./admin-db");
  const rows = await adminQuery(sql, query);

  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new Error("AUDIT_LOG_WRITE_FAILED");
  }

  return rows[0];
}

module.exports = {
  guardAdminWrite,
  writeAuditLog
};
