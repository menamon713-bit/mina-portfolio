"use strict";

const net = require("net");

// Expand any valid IPv6 string into 8 zero-padded hex groups.
function expandIPv6(input) {
  let address = input.split("%")[0]; // drop zone id (fe80::1%eth0)

  // Embedded IPv4 tail (::ffff:1.2.3.4) -> two hex groups.
  if (address.includes(".")) {
    const index = address.lastIndexOf(":");
    const octets = address.slice(index + 1).split(".").map(Number);

    if (
      octets.length !== 4 ||
      octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
    ) {
      return null;
    }

    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);

    address = `${address.slice(0, index + 1)}${hi}:${lo}`;
  }

  let groups;

  if (address.includes("::")) {
    const [head, tail] = address.split("::");
    const h = head ? head.split(":") : [];
    const t = tail ? tail.split(":") : [];
    const fill = 8 - h.length - t.length;

    if (fill < 0) return null;

    groups = [...h, ...Array(fill).fill("0"), ...t];
  } else {
    groups = address.split(":");
  }

  if (
    groups.length !== 8 ||
    groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))
  ) {
    return null;
  }

  return groups.map((g) => g.padStart(4, "0").toLowerCase());
}

// IPv4 stays as-is. IPv6 collapses to its /64, because a single user or
// attacker normally controls a whole /64 and could otherwise rotate
// addresses to dodge per-IP limits.
function normalizeIP(ip) {
  const version = net.isIP(ip);

  if (version === 4) return ip;
  if (version !== 6) return null;

  const groups = expandIPv6(ip);

  if (!groups) return null;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) -> treat as the IPv4 address.
  if (
    groups.slice(0, 5).every((g) => g === "0000") &&
    groups[5] === "ffff"
  ) {
    const hi = parseInt(groups[6], 16);
    const lo = parseInt(groups[7], 16);

    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }

  return `${groups.slice(0, 4).join(":")}::/64`;
}

// On Vercel, x-forwarded-for is set by the platform (client-supplied values
// are overwritten), so the first entry is the real client address.
function getClientKey(req) {
  const value = req?.headers?.["x-forwarded-for"];

  if (typeof value !== "string" || value.length > 1024) {
    return "unknown";
  }

  const first = value.split(",")[0].trim();

  return normalizeIP(first) || "unknown";
}

module.exports = { getClientKey, normalizeIP };
