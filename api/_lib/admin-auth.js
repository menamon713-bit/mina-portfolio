"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "mash_admin_session";
const SESSION_SECONDS = 2 * 60 * 60; // 2 hours (was 8)
const CLOCK_SKEW_MS = 60 * 1000;
const MAX_TOKEN_LENGTH = 2048;
const MAX_COOKIE_HEADER_LENGTH = 16384;

/* ---------- config ---------- */

function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (
    typeof secret !== "string" ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short.");
  }

  return secret;
}

// Optional. Change ADMIN_SESSION_VERSION in Vercel env to instantly
// invalidate ALL existing sessions (stolen cookie, suspected leak, etc).
function getVersion() {
  const v = process.env.ADMIN_SESSION_VERSION;

  if (v === undefined || v === "") return "1";

  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,32}$/.test(v)) {
    // Fail closed: a bad value must not silently disable revocation.
    throw new Error("ADMIN_SESSION_VERSION is invalid.");
  }

  return v;
}

/* ---------- signing ---------- */

function sign(value) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(value)
    .digest("base64url");
}

function createSession() {
  const now = Date.now();

  const payload = {
    iat: now,
    exp: now + SESSION_SECONDS * 1000,
    v: getVersion(),
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

    const now = Date.now();

    return (
      Number.isSafeInteger(data.iat) &&
      Number.isSafeInteger(data.exp) &&
      data.exp > now &&
      data.iat <= now + CLOCK_SKEW_MS &&
      data.exp - data.iat <= SESSION_SECONDS * 1000 &&
      data.v === getVersion() &&
      typeof data.nonce === "string" &&
      /^[a-f0-9]{64}$/.test(data.nonce)
    );
  } catch {
    return false;
  }
}

/* ---------- cookies / headers ---------- */

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

function appendSetCookie(res, cookie) {
  const existing = res.getHeader("Set-Cookie");

  if (!existing) {
    res.setHeader("Set-Cookie", cookie);
  } else {
    res.setHeader("Set-Cookie", [].concat(existing, cookie));
  }
}

function setNoStore(res) {
  res.setHeader("Cache-Control", "no-store");
}

function setSessionCookie(res, token) {
  if (
    typeof token !== "string" ||
    token.length > MAX_TOKEN_LENGTH ||
    !verifySession(token)
  ) {
    throw new Error("Invalid session token.");
  }

  setNoStore(res);

  appendSetCookie(
    res,
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}`
  );
}

function clearSessionCookie(res) {
  setNoStore(res);

  appendSetCookie(
    res,
    `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0`
  );
}

/* ---------- guards ---------- */

function requireAdmin(req, res) {
  // Never let any admin response be cached.
  setNoStore(res);

  const token = getCookie(req);

  let authenticated = false;

  try {
    authenticated = verifySession(token);
  } catch (err) {
    // Misconfiguration (missing secret / bad version) fails closed,
    // but is visible in server logs instead of looking like a normal 401.
    console.error("[admin-auth]", err.message);
    authenticated = false;
  }

  if (!authenticated) {
    clearSessionCookie(res);

    res.status(401).json({
      error: "Unauthorized."
    });

    return false;
  }

  return true;
}

// Use on every state-changing request (POST/PUT/PATCH/DELETE), including login.
// Optional: set ADMIN_ALLOWED_ORIGIN (e.g. https://mina-portfolio-pied.vercel.app)
// to pin the exact origin instead of trusting the Host header.
function checkSameOrigin(req) {
  const origin = req?.headers?.origin;
  const host = req?.headers?.host;
  const fetchSite = req?.headers?.["sec-fetch-site"];

  // Browsers send this on fetch/XHR; anything not same-origin is rejected.
  if (
    fetchSite !== undefined &&
    (typeof fetchSite !== "string" || fetchSite !== "same-origin")
  ) {
    return false;
  }

  if (typeof origin !== "string" || origin.length > 2048) {
    return false;
  }

  try {
    const originURL = new URL(origin);

    if (
      originURL.protocol !== "https:" ||
      originURL.username !== "" ||
      originURL.password !== "" ||
      originURL.pathname !== "/" ||
      originURL.search !== "" ||
      originURL.hash !== ""
    ) {
      return false;
    }

    const pinned = process.env.ADMIN_ALLOWED_ORIGIN;

    if (typeof pinned === "string" && pinned !== "") {
      return originURL.origin === new URL(pinned).origin;
    }

    if (
      typeof host !== "string" ||
      !host ||
      host.length > 255 ||
      host.includes(",") ||
      /\s/.test(host)
    ) {
      return false;
    }

    return originURL.origin === new URL(`https://${host}`).origin;
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
