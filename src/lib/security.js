import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

// ── Client IP ─────────────────────────────────────────────────────────────
// Requires nginx to OVERWRITE these headers (see deploy/nginx/README.md):
//   proxy_set_header X-Real-IP $remote_addr;
//   proxy_set_header X-Forwarded-For $remote_addr;
export function getClientIp(headers) {
  const get = (n) =>
    typeof headers?.get === "function" ? headers.get(n) : headers?.[n];
  const real = get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const xff = get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].slice(0, 64); // last hop = trusted proxy-appended
  }
  return "unknown";
}

// IPv6 clients can rotate inside their /64, so rate-limit on the /64 prefix.
export function ipBucketKey(ip) {
  if (!ip || !ip.includes(":")) return ip || "unknown";
  const [head, tail = ""] = ip.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return full.slice(0, 4).map((x) => x.toLowerCase().padStart(4, "0")).join(":") + "::/64";
}

// ── Crypto helpers ────────────────────────────────────────────────────────
function secret() {
  const s = process.env.OTP_PEPPER || process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET (or OTP_PEPPER) is not set");
  return s;
}
export function hmacHex(value, context) {
  return createHmac("sha256", secret()).update(`${context}:${value}`).digest("hex");
}
export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a), "utf8");
  const y = Buffer.from(String(b), "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
export function generateOtp() {
  return String(randomInt(100000, 1000000));
}
export function safeEqualSecret(a, b) {
  return safeEqualHex(hmacHex(a, "cmp"), hmacHex(b, "cmp"));
}

// ── Logging helpers ───────────────────────────────────────────────────────
export function maskPhone(phone) {
  const p = String(phone || "");
  return p.length >= 7 ? `${p.slice(0, 4)}***${p.slice(-2)}` : "***";
}

const SENSITIVE_KEY = /(^|_)(password|passwd|hash|token|secret|apikey|api_key|authority|authorization|cookie)($|_)|password/i;
export function redactSensitive(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redactSensitive(v, depth + 1));
  if (typeof value === "object") {
    if (value instanceof Date) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[REDACTED]" : redactSensitive(v, depth + 1);
    }
    return out;
  }
  return value;
}
