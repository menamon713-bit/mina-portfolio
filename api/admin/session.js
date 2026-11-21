"use strict";

const { requireAdmin } = require("../_lib/admin-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!(await requireAdmin(req, res))) return;

  return res.status(200).json({
    authenticated: true
  });
};
