import { createHash } from "node:crypto";

/**
 * Deterministic canonical JSON serialization (modeled on REA's canonicalDigest.js).
 * Sorts object keys in strict ASCII/code-point order, normalizes -0 to 0,
 * rejects NaN/Infinity, and produces path-independent cryptographic commitments.
 */
export function canonicalJson(value, contextLabel = "Canonical value") {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "boolean") return value ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${contextLabel} cannot contain non-finite number: ${value}`);
    }
    return Object.is(value, -0) ? "0" : JSON.stringify(value);
  }
  if (t === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item, idx) =>
      item === undefined ? "null" : canonicalJson(item, `${contextLabel}[${idx}]`)
    );
    return `[${items.join(",")}]`;
  }
  if (t === "object") {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const pairs = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJson(value[k], `${contextLabel}.${k}`)}`
    );
    return `{${pairs.join(",")}}`;
  }
  throw new TypeError(`${contextLabel} contains unsupported type: ${t}`);
}

/**
 * Domain-separated SHA-256 hex digest (64 hex chars).
 */
export function digestCanonicalValue(value, domainTag = "REL") {
  const payload = `${domainTag}\u0000${canonicalJson(value, domainTag)}`;
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Prefixed content-addressed identifier: ev_<64hex>, obl_<64hex>, ecl_<64hex>, unk_<64hex>, sub_<64hex>.
 */
export function prefixedDigest(prefix, value, domainTag) {
  return `${prefix}_${digestCanonicalValue(value, domainTag)}`;
}

export function sha256Text(text) {
  return createHash("sha256").update(String(text), "utf8").digest("hex");
}

export function compareAsciiStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function uniqueSortedAscii(items) {
  return [...new Set(items)].sort(compareAsciiStrings);
}
