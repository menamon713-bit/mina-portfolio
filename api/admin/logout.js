"use strict";

const {
  getCookie,
  revokeSession,
  clearSessionCookie,
  checkSameOrigin
} = require("../_lib/admin-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  if (!checkSameOrigin(req)) {
    return res.status(403).json({
      error: "Forbidden origin."
    });
  }

  const token = getCookie(req);

  if (token) {
    try {
      await revokeSession(token);
    } catch {
      console.error("[admin-logout] Session revocation failed.");

      return res.status(503).json({
        error: "Logout service temporarily unavailable."
      });
    }
  }

  clearSessionCookie(res);

  return res.status(200).json({
    success: true
  });
};
