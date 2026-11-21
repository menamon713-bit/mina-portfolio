"use strict";

// Usage:  node tools/hash-password.js
// Prompts for the password (hidden) and prints ADMIN_PASSWORD_HASH=...
// Put the printed value in Vercel -> Settings -> Environment Variables.
// Do NOT commit it, and do NOT type the password as a command argument
// (it would be saved in your shell history).

const crypto = require("crypto");
const readline = require("readline");

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MIN_LENGTH = 14;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);

  const hash = crypto.scryptSync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2 + 1024 * 1024
  });

  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64url"),
    hash.toString("base64url")
  ].join("$");
}

function askHidden(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: Boolean(process.stdin.isTTY)
    });

    rl.stdoutMuted = false;

    rl._writeToOutput = function (text) {
      if (rl.stdoutMuted && text !== "\n" && text !== "\r\n") {
        rl.output.write("*");
      } else {
        rl.output.write(text);
      }
    };

    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });

    rl.stdoutMuted = true;
  });
}

async function main() {
  const first = await askHidden("Admin password: ");

  if (first.length < MIN_LENGTH) {
    console.error(`Too short. Use at least ${MIN_LENGTH} characters.`);
    process.exit(1);
  }

  const second = await askHidden("Repeat password: ");

  if (first !== second) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  console.log("\nAdd this to Vercel environment variables:\n");
  console.log(`ADMIN_PASSWORD_HASH=${hashPassword(first)}`);
  console.log(
    "\nThen delete ADMIN_PASSWORD from Vercel and redeploy."
  );
}

if (require.main === module) {
  main();
}

module.exports = { hashPassword };
