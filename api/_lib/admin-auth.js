"use strict";

const crypto = require("crypto");

const COOKIE_NAME = "mash_admin_session";
const SESSION_SECONDS = 2 * 60 * 60;
const CLOCK_SKEW_MS = 60 * 1000;
const MAX_TOKEN_LENGTH = 2048;
const MAX_COOKIE_HEADER_LENGTH = 16384;

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

function getVersion() {
  const version = process.env.ADMIN_SESSION_VERSION;

  if (version === undefined || version === "") {
    return "1";
  }

  if (
    typeof version !== "string" ||
    !/^[A-Za-z0-9_-]{1,32}$/.test(version)
  ) {
    throw new Error("ADMIN_SESSION_VERSION is invalid.");
  }

  return version;
}

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
    const expected = Buffer.from(
      sign(payload),
      "ascii"
    );

    const received = Buffer.from(
      signature,
      "ascii"
    );

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      return false;
    }

    const decoded = Buffer.from(
      payload,
      "base64url"
    );

    if (
      decoded.toString("base64url") !== payload
    ) {
      return false;
    }

    const data = JSON.parse(
      decoded.toString("utf8")
    );

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
      data.iat >= 0 &&
      data.exp > data.iat &&
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
    res.setHeader(
      "Set-Cookie",
      [].concat(existing, cookie)
    );
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

function requireAdmin(req, res) {
  setNoStore(res);

  let authenticated = false;

  try {
    authenticated = verifySession(getCookie(req));
  } catch {
    console.error("[admin-auth] Authentication configuration error.");
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

function getAllowedOrigin() {
  const value = process.env.ADMIN_ALLOWED_ORIGIN;

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 2048
  ) {
    throw new Error("ADMIN_ALLOWED_ORIGIN is missing.");
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("ADMIN_ALLOWED_ORIGIN is invalid.");
  }

  return url.origin;
}

function checkSameOrigin(req) {
  const origin = req?.headers?.origin;
  const fetchSite = req?.headers?.["sec-fetch-site"];

  if (
    fetchSite !== undefined &&
    (
      typeof fetchSite !== "string" ||
      fetchSite !== "same-origin"
    )
  ) {
    return false;
  }

  if (
    typeof origin !== "string" ||
    origin.length === 0 ||
    origin.length > 2048
  ) {
    return false;
  }

  try {
    const requestOrigin = new URL(origin);

    if (
      requestOrigin.protocol !== "https:" ||
      requestOrigin.username !== "" ||
      requestOrigin.password !== "" ||
      requestOrigin.pathname !== "/" ||
      requestOrigin.search !== "" ||
      requestOrigin.hash !== ""
    ) {
      return false;
    }

    return requestOrigin.origin === getAllowedOrigin();
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
