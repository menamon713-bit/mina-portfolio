"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "mash_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_TOKEN_LENGTH = 2048;
const MAX_COOKIE_HEADER_LENGTH = 16384;

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
    token.length === 0 ||
    token.length > MAX_TOKEN_LENGTH
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
    const expected = Buffer.from(sign(payload), "ascii");
    const received = Buffer.from(signature, "ascii");

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return false;
    }

    const decoded = Buffer.from(payload, "base64url");

    if (decoded.toString("base64url") !== payload) {
      return false;
    }

    const data = JSON.parse(decoded.toString("utf8"));

    if (
      data === null ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return false;
    }

    return (
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
  const header = req?.headers?.cookie;

  if (
    typeof header !== "string" ||
    header.length > MAX_COOKIE_HEADER_LENGTH
  ) {
    return null;
  }

  let session = null;

  for (const item of header.split(";")) {
    const index = item.indexOf("=");

    if (index === -1) continue;

    const name = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();

    if (name !== COOKIE_NAME) continue;

    // Reject duplicate session cookies.
    if (session !== null) {
      return null;
    }

    session = value;
  }

  return session;
}

function setSessionCookie(res, token) {
  if (
    typeof token !== "string" ||
    token.length > MAX_TOKEN_LENGTH ||
    !verifySession(token)
  ) {
    throw new Error("Invalid session token.");
  }

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

  let authenticated = false;

  try {
    authenticated = verifySession(token);
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    res.setHeader("Cache-Control", "no-store");
    clearSessionCookie(res);

    res.status(401).json({
      error: "Unauthorized."
    });

    return false;
  }

  return true;
}

function checkSameOrigin(req) {
  const origin = req?.headers?.origin;
  const host = req?.headers?.host;

  if (
    typeof origin !== "string" ||
    origin.length > 2048 ||
    typeof host !== "string" ||
    !host ||
    host.length > 255 ||
    host.includes(",") ||
    /\s/.test(host)
  ) {
    return false;
  }

  try {
    const originURL = new URL(origin);
    const requestURL = new URL(`https://${host}`);

    return (
      originURL.protocol === "https:" &&
      originURL.origin === requestURL.origin &&
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
