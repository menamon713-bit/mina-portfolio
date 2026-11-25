"use strict";

const net = require("net");

const MAX_IP_LENGTH = 64;
const MAX_HEADER_LENGTH = 1024;

function normalizeIPv4(ip) {
  if (net.isIP(ip) !== 4) return null;

  return ip
    .split(".")
    .map((part) => String(Number(part)))
    .join(".");
}

function expandIPv6(input) {
  let address = input.toLowerCase();

  if (address.includes("%")) return null;

  if (address.includes(".")) {
    const index = address.lastIndexOf(":");
    if (index === -1) return null;

    const ipv4 = normalizeIPv4(address.slice(index + 1));
    if (!ipv4) return null;

    const octets = ipv4.split(".").map(Number);

    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);

    address = `${address.slice(0, index + 1)}${hi}:${lo}`;
  }

  let groups;

  if (address.includes("::")) {
    const parts = address.split("::");
    if (parts.length !== 2) return null;

    const head = parts[0] ? parts[0].split(":") : [];
    const tail = parts[1] ? parts[1].split(":") : [];

    const fill = 8 - head.length - tail.length;
    if (fill < 1) return null;

    groups = [
      ...head,
      ...Array(fill).fill("0"),
      ...tail
    ];
  } else {
    groups = address.split(":");
  }

  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))
  ) {
    return null;
  }

  return groups.map((group) =>
    group.padStart(4, "0")
  );
}

function normalizeIP(ip) {
  if (typeof ip !== "string") return null;

  ip = ip.trim();

  if (!ip || ip.length > MAX_IP_LENGTH) return null;

  const version = net.isIP(ip);

  if (version === 4) {
    return normalizeIPv4(ip);
  }

  if (version !== 6) return null;

  const groups = expandIPv6(ip);
  if (!groups) return null;

  // IPv4-mapped IPv6.
  if (
    groups.slice(0, 5).every((group) => group === "0000") &&
    groups[5] === "ffff"
  ) {
    const hi = parseInt(groups[6], 16);
    const lo = parseInt(groups[7], 16);

    return [
      hi >> 8,
      hi & 255,
      lo >> 8,
      lo & 255
    ].join(".");
  }

  // Group IPv6 addresses by /64.
  return `${groups.slice(0, 4).join(":")}::/64`;
}

function getClientKey(req) {
  const headers = req?.headers;

  if (!headers || typeof headers !== "object") {
    return null;
  }

  const value = headers["x-forwarded-for"];

  if (
    typeof value !== "string" ||
    value.length > MAX_HEADER_LENGTH ||
    /[\r\n]/.test(value)
  ) {
    return null;
  }

  // Reject proxy chains instead of trusting an arbitrary first entry.
  if (value.includes(",")) {
    return null;
  }

  const ip = value.trim();

  if (!ip || ip.length > MAX_IP_LENGTH) {
    return null;
  }

  const normalized = normalizeIP(ip);

  if (!normalized) {
    return null;
  }

  return `ip:${normalized}`;
}

module.exports = {
  getClientKey,
  normalizeIP
};
