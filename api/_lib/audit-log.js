"use strict";

const { adminQuery } = require("./admin-db");

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
  `;

  await adminQuery(sql, query);
}

module.exports = { writeAuditLog };
