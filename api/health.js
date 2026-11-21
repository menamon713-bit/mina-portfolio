"use strict";

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      message: "Method not allowed."
    });
  }

  const app = req.query?.app;

  // Normal health check
  if (!app) {
    return res.status(200).json({
      success: true,
      status: "online"
    });
  }

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
