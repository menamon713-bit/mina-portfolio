"use strict";

const crypto = require("crypto");

const TOKEN_LIFETIME_SECONDS = 120;

function getHmacSecret() {
  const secret = process.env.ADMIN_RLS_HMAC_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error("ADMIN_RLS_HMAC_SECRET_INVALID");
  }

  return secret;
}

function createAdminToken() {
  const expiresAt =
    Math.floor(Date.now() / 1000) +
    TOKEN_LIFETIME_SECONDS;

  const nonce = crypto.randomBytes(32).toString("hex");
  const payload = `${expiresAt}.${nonce}`;

  const signature = crypto
    .createHmac("sha256", getHmacSecret())
    .update(payload, "utf8")
    .digest("hex");

  return `${payload}.${signature}`;
}

async function adminQuery(sql, query) {
  if (
    typeof sql !== "function" ||
    typeof sql.transaction !== "function" ||
    !query ||
    typeof query !== "object"
  ) {
    throw new Error("ADMIN_DATABASE_INVALID_ARGUMENT");
  }

  const token = createAdminToken();

  const results = await sql.transaction([
    sql`
      SELECT set_config(
        'app.admin_token',
        ${token},
        true
      )
    `,
    query
  ]);

  if (!Array.isArray(results) || results.length !== 2) {
    throw new Error("ADMIN_DATABASE_INVALID_RESULT");
  }

  return results[1];
}

module.exports = {
  adminQuery
};
