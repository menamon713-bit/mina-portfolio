"use strict";

/**
 * Runs one admin query inside a transaction.
 * The admin marker exists only for this transaction.
 *
 * IMPORTANT:
 * Call this helper only after requireAdmin succeeds.
 */

async function adminQuery(sql, buildQuery) {
  if (
    typeof sql !== "function" ||
    typeof sql.transaction !== "function" ||
    typeof buildQuery !== "function"
  ) {
    throw new Error("ADMIN_DATABASE_INVALID_ARGUMENT");
  }

  const results = await sql.transaction((txn) => [
    txn`
      SELECT set_config(
        'app.is_admin',
        'true',
        true
      )
    `,
    buildQuery(txn)
  ]);

  if (!Array.isArray(results) || results.length !== 2) {
    throw new Error("ADMIN_DATABASE_INVALID_RESULT");
  }

  return results[1];
}

module.exports = {
  adminQuery
};
