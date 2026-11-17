const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TOKEN_LENGTH = 2048;

function allowedHostnames() {
  return (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isTurnstileConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
    process.env.TURNSTILE_SECRET_KEY &&
    allowedHostnames().length > 0
  );
}

/**
 * Validate a Turnstile token server-side. Tokens are single-use and short-lived;
 * never treat the browser callback alone as proof that CAPTCHA succeeded.
 */
export async function verifyTurnstileToken({ token, remoteIp, expectedHostname }) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hostAllowlist = allowedHostnames();
  const hostname = String(expectedHostname || "").trim().toLowerCase();

  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || hostAllowlist.length === 0) {
    return { ok: false, reason: "not_configured" };
  }
  if (!token || typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) {
    return { ok: false, reason: "invalid" };
  }
  if (!hostname || !hostAllowlist.includes(hostname)) {
    return { ok: false, reason: "host_not_allowed" };
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });

    if (!response.ok) return { ok: false, reason: "unavailable" };
    const result = await response.json();
    const verifiedHostname = String(result?.hostname || "").toLowerCase();

    if (
      result?.success !== true ||
      result?.action !== "login" ||
      verifiedHostname !== hostname ||
      !hostAllowlist.includes(verifiedHostname)
    ) {
      return { ok: false, reason: "invalid" };
    }

    return { ok: true };
  } catch {
    // Fail closed if Siteverify is unreachable or times out.
    return { ok: false, reason: "unavailable" };
  }
}
