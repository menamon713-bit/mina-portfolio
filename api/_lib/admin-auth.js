"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "mash_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing or too short."
    );
  }

  return secret;
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function createSession() {
  const payload = {
    exp: Date.now() + SESSION_SECONDS * 1000,
    nonce: crypto.randomBytes(32).toString("hex")
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function verifySession(token) {
  if (
    typeof token !== "string" ||
    token.length > 2048
  ) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [payload, signature] = parts;

  if (
    !/^[A-Za-z0-9_-]+$/.test(payload) ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(sign(payload));
    const received = Buffer.from(signature);

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return false;
    }

    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    );

    return (
      data !== null &&
      typeof data === "object" &&
      Number.isSafeInteger(data.exp) &&
      data.exp > Date.now() &&
      typeof data.nonce === "string" &&
      /^[a-f0-9]{64}$/.test(data.nonce)
    );
  } catch {
    return false;
  }
}

function getCookie(req) {
  const header = req.headers.cookie || "";

  if (typeof header !== "string") {
    return null;
  }

  for (const item of header.split(";")) {
    const index = item.indexOf("=");

    if (index === -1) continue;

    const name = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (name === COOKIE_NAME) {
      return value;
    }
  }

  return null;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`
  );
}

function requireAdmin(req, res) {
  const token = getCookie(req);

  if (!verifySession(token)) {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`
    );

    res.status(401).json({
      error: "Unauthorized."
    });

    return false;
  }

  return true;
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;

  if (
    typeof origin !== "string" ||
    origin.length > 2048
  ) {
    return false;
  }

  const forwardedHost =
    req.headers["x-forwarded-host"];

  const host =
    typeof forwardedHost === "string"
      ? forwardedHost.split(",")[0].trim()
      : req.headers.host;

  if (
    typeof host !== "string" ||
    !host ||
    host.includes(",")
  ) {
    return false;
  }

  const forwardedProto =
    req.headers["x-forwarded-proto"];

  const protocol =
    typeof forwardedProto === "string"
      ? forwardedProto.split(",")[0].trim()
      : "https";

  if (!["https", "http"].includes(protocol)) {
    return false;
  }

  try {
    const originURL = new URL(origin);

    return (
      originURL.protocol === `${protocol}:` &&
      originURL.host.toLowerCase() === host.toLowerCase() &&
      originURL.username === "" &&
      originURL.password === "" &&
      originURL.pathname === "/" &&
      originURL.search === "" &&
      originURL.hash === ""
    );
  } catch {
    return false;
  }
}

module.exports = {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
  checkSameOrigin
};
