module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  return res.status(200).json({
    success: true,
    service: "M.A.S.H CYVEX API",
    status: "online",
    version: "1.0.0"
  });
};
