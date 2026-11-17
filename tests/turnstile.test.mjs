import test from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstileToken } from "../src/lib/turnstile.js";

const originalFetch = globalThis.fetch;
const envKeys = ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY", "TURNSTILE_ALLOWED_HOSTNAMES"];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function configure() {
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  process.env.TURNSTILE_SECRET_KEY = "test-secret-key";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "staging.borjak.test,borjak.test";
}

test("accepts only a successful login token for the expected hostname", async () => {
  configure();
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://challenges.cloudflare.com/turnstile/v0/siteverify");
    assert.equal(options.method, "POST");
    const form = new URLSearchParams(options.body);
    assert.equal(form.get("secret"), "test-secret-key");
    assert.equal(form.get("response"), "valid-token");
    return new Response(JSON.stringify({ success: true, action: "login", hostname: "staging.borjak.test" }), { status: 200 });
  };
  const result = await verifyTurnstileToken({
    token: "valid-token", remoteIp: "203.0.113.10", expectedHostname: "staging.borjak.test",
  });
  assert.deepEqual(result, { ok: true });
});

test("rejects wrong action or hostname", async () => {
  configure();
  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "signup", hostname: "staging.borjak.test" }), { status: 200 });
  const wrongAction = await verifyTurnstileToken({ token: "token", expectedHostname: "staging.borjak.test" });
  assert.deepEqual(wrongAction, { ok: false, reason: "invalid" });

  globalThis.fetch = async () => new Response(JSON.stringify({ success: true, action: "login", hostname: "evil.test" }), { status: 200 });
  const wrongHost = await verifyTurnstileToken({ token: "token", expectedHostname: "staging.borjak.test" });
  assert.deepEqual(wrongHost, { ok: false, reason: "invalid" });
});

test("fails closed when configuration is missing or Siteverify is unavailable", async () => {
  delete process.env.TURNSTILE_SECRET_KEY;
  const unconfigured = await verifyTurnstileToken({ token: "token", expectedHostname: "staging.borjak.test" });
  assert.deepEqual(unconfigured, { ok: false, reason: "not_configured" });

  configure();
  globalThis.fetch = async () => { throw new Error("network unavailable"); };
  const unavailable = await verifyTurnstileToken({ token: "token", expectedHostname: "staging.borjak.test" });
  assert.deepEqual(unavailable, { ok: false, reason: "unavailable" });
});

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});
