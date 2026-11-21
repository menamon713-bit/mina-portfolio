"use strict";

const net = require("net");

function expandIPv6(input) {
  let address = input.split("%")[0];

  if (address.includes(".")) {
    const index = address.lastIndexOf(":");

    if (index === -1) return null;

    const octets = address
      .slice(index + 1)
      .split(".")
      .map(Number);

    if (
      octets.length !== 4 ||
      octets.some(
        (n) =>
          !Number.isInteger(n) ||
          n < 0 ||
          n > 255
      )
    ) {
      return null;
    }

    const hi = (
      (octets[0] << 8) |
      octets[1]
    ).toString(16);

    const lo = (
      (octets[2] << 8) |
      octets[3]
    ).toString(16);

    address =
      `${address.slice(0, index + 1)}${hi}:${lo}`;
  }

  let groups;

  if (address.includes("::")) {
    const parts = address.split("::");

    if (parts.length !== 2) return null;

    const head = parts[0]
      ? parts[0].split(":")
      : [];

    const tail = parts[1]
      ? parts[1].split(":")
      : [];

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
    groups.some(
      (group) =>
        !/^[0-9a-fA-F]{1,4}$/.test(group)
    )
  ) {
    return null;
  }

  return groups.map(
    (group) => group.padStart(4, "0").toLowerCase()
  );
}

function normalizeIP(ip) {
  if (typeof ip !== "string") return null;

  const version = net.isIP(ip);

  if (version === 4) {
    return ip;
  }

  if (version !== 6) {
    return null;
  }

  const groups = expandIPv6(ip);

  if (!groups) return null;

  // IPv4-mapped IPv6.
  if (
    groups.slice(0, 5).every(
      (group) => group === "0000"
    ) &&
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

  // IPv6 /64 grouping.
  return `${groups.slice(0, 4).join(":")}::/64`;
}

function getClientKey(req) {
  const value = req?.headers?.["x-forwarded-for"];

  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return null;
  }

  const first = value.split(",")[0].trim();

  if (!first || first.length > 64) {
    return null;
  }

  const normalized = normalizeIP(first);

  if (!normalized) {
    return null;
  }

  return `ip:${normalized}`;
}

module.exports = {
  getClientKey,
  normalizeIP
};
