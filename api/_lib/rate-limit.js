"use strict";

const TIMEOUT_MS = 3000;
const MAX_KEY_LENGTH = 200;

const HIT_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])
  local ttl = redis.call("TTL", KEYS[1])

  if count == 1 or ttl < 0 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end

  return count
`;

const CONSUME_SCRIPT = `
  local current = tonumber(redis.call("GET", KEYS[1]) or "0")
  local ttl = redis.call("TTL", KEYS[1])
  local limit = tonumber(ARGV[2])
  local window = tonumber(ARGV[1])

  if current >= limit then
    if ttl < 0 then
      redis.call("EXPIRE", KEYS[1], window)
      ttl = window
    end

    return {0, current, ttl}
  end

  local count = redis.call("INCR", KEYS[1])
  ttl = redis.call("TTL", KEYS[1])

  if count == 1 or ttl < 0 then
    redis.call("EXPIRE", KEYS[1], window)
    ttl = window
  end

  return {1, count, ttl}
`;

function validateKey(key) {
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > MAX_KEY_LENGTH ||
    !/^[A-Za-z0-9:_./-]+$/.test(key)
  ) {
    throw new Error("RATE_LIMIT_INVALID_KEY");
  }
}

function validateWindow(windowSeconds) {
  if (
    !Number.isSafeInteger(windowSeconds) ||
    windowSeconds < 1 ||
    windowSeconds > 86400
  ) {
    throw new Error("RATE_LIMIT_INVALID_WINDOW");
  }
}

function getConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (
    typeof url !== "string" ||
    typeof token !== "string" ||
    !url ||
    !token
  ) {
    throw new Error("RATE_LIMIT_CONFIG_MISSING");
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    !parsed.hostname
  ) {
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  }

  return {
    url: parsed.toString(),
    token
  };
}

async function command(args) {
  const { url, token } = getConfig();

  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(args),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error("RATE_LIMIT_SERVICE_ERROR");
    }

    const data = await response.json();

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      data.error ||
      !Object.prototype.hasOwnProperty.call(data, "result")
    ) {
      throw new Error("RATE_LIMIT_INVALID_RESPONSE");
    }

    return data.result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("RATE_LIMIT_TIMEOUT");
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function hit(key, windowSeconds) {
  validateKey(key);
  validateWindow(windowSeconds);

  const result = await command([
    "EVAL",
    HIT_SCRIPT,
    "1",
    key,
    String(windowSeconds)
  ]);

  const count = Number(result);

  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return count;
}

async function consume(key, windowSeconds, limit) {
  validateKey(key);
  validateWindow(windowSeconds);

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100000
  ) {
    throw new Error("RATE_LIMIT_INVALID_LIMIT");
  }

  const result = await command([
    "EVAL",
    CONSUME_SCRIPT,
    "1",
    key,
    String(windowSeconds),
    String(limit)
  ]);

  if (!Array.isArray(result) || result.length !== 3) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  const allowed = Number(result[0]);
  const count = Number(result[1]);
  const ttl = Number(result[2]);

  if (
    (allowed !== 0 && allowed !== 1) ||
    !Number.isSafeInteger(count) ||
    count < 0 ||
    !Number.isSafeInteger(ttl) ||
    ttl < -2
  ) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return {
    allowed: allowed === 1,
    count,
    retryAfter: Math.max(1, ttl)
  };
}

async function peek(key) {
  validateKey(key);

  const result = await command(["GET", key]);

  if (result === null || result === undefined) {
    return 0;
  }

  const count = Number(result);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return count;
}

async function reset(key) {
  validateKey(key);

  await command(["DEL", key]);
}

// Atomic one-time claim using Redis SET NX.
async function claimOnce(key, ttlSeconds) {
  validateKey(key);
  validateWindow(ttlSeconds);

  const result = await command([
    "SET",
    key,
    "1",
    "EX",
    String(ttlSeconds),
    "NX"
  ]);

  return result === "OK";
}

module.exports = {
  hit,
  consume,
  peek,
  reset,
  claimOnce
};
