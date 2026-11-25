"use strict";

const crypto = require("crypto");
const { claimOnce } = require("./rate-limit");

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function getSecret() {
  const secret = process.env.ADMIN_TOTP_SECRET;

  if (
    typeof secret !== "string" ||
    !/^[A-Z2-7]{32}$/.test(secret)
  ) {
    throw new Error("ADMIN_TOTP_SECRET is missing or invalid.");
  }

  return secret;
}

function decodeBase32(value) {
  let buffer = 0;
  let bits = 0;
  const bytes = [];

  for (const character of value) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index < 0) {
      throw new Error("Invalid Base32 secret.");
    }

    buffer = (buffer << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }

  if (bits !== 0) {
    throw new Error("Invalid Base32 secret length.");
  }

  return Buffer.from(bytes);
}

function generateCode(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = crypto
    .createHmac("sha1", secret)
    .update(counter)
    .digest();

  const offset = digest[digest.length - 1] & 0x0f;

  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 1000000).padStart(6, "0");
}

function safeCompare(a, b) {
  const left = Buffer.from(a, "ascii");
  const right = Buffer.from(b, "ascii");

  return (
    left.length === right.length &&
    crypto.timingSafeEqual(left, right)
  );
}

async function verifyAndConsumeTotp(code) {
  if (
    typeof code !== "string" ||
    !/^\d{6}$/.test(code)
  ) {
    return false;
  }

  const secret = decodeBase32(getSecret());
  const currentStep = Math.floor(Date.now() / 30000);

  for (
    let step = currentStep - 1;
    step <= currentStep + 1;
    step++
  ) {
    const expected = generateCode(secret, step);

    if (!safeCompare(code, expected)) {
      continue;
    }

    // Prevent reusing the same accepted time step.
    return claimOnce(
      `mash:admin-totp:${step}`,
      90
    );
  }

  return false;
}

module.exports = {
  verifyAndConsumeTotp
};
