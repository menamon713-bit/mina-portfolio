"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "mash_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short.");
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
    nonce: crypto.randomBytes(16).toString("hex")
  };

  const encoded = Buffer
    .from(JSON.stringify(payload))
    .toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

function verifySession(token) {
  if (typeof token !== "string") return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;

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
      data &&
      Number.isFinite(data.exp) &&
      data.exp > Date.now() &&
      typeof data.nonce === "string"
    );
  } catch (_) {
    return false;
  }
}

function getCookie(req) {
  const header = req.headers.cookie || "";

  const cookies = header.split(";");

  for (const item of cookies) {
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
    res.status(401).json({
      error: "Unauthorized."
    });

    return false;
  }

  return true;
}

function checkSameOrigin(req) {
  const origin = req.headers.origin;

  if (!origin) return true;

  const host =
    req.headers["x-forwarded-host"] ||
    req.headers.host;

  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch (_) {
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
