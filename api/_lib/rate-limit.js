"use strict";

const TIMEOUT_MS = 3000;

// Atomic counter. Also repairs a key that somehow lost its TTL,
// so a counter can never get stuck forever.
const HIT_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])
  if count == 1 or redis.call("TTL", KEYS[1]) < 0 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return count
`;

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
    parsed.password
  ) {
    throw new Error("RATE_LIMIT_CONFIG_INVALID");
  }

  return { url: parsed.toString(), token };
}

async function command(args) {
  const { url, token } = getConfig();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

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

    if (!data || typeof data !== "object" || data.error) {
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

// Count one event for `key` inside a window. Returns the new count.
async function hit(key, windowSeconds) {
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

// Read the current count without changing it.
async function peek(key) {
  const result = await command(["GET", key]);

  if (result === null || result === undefined) return 0;

  const count = Number(result);

  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("RATE_LIMIT_INVALID_RESPONSE");
  }

  return count;
}

async function reset(key) {
  await command(["DEL", key]);
}

module.exports = { hit, peek, reset };
