import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { hmacHex } from "@/lib/security";
import { issueOtp, verifyOtp, resetOtpIssuanceState, OTP_MAX_ATTEMPTS } from "@/lib/otp";

const phone = () => "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");

test("rate limit is atomic under concurrency", async () => {
  const key = "t:rl:" + Math.random();
  const rs = await Promise.all(Array.from({ length: 30 }, () => consumeRateLimit(key, 5, 60)));
  assert.equal(rs.filter((r) => r.allowed).length, 5);
});

test("OTP cooldown is atomic: parallel requests send exactly one SMS", async () => {
  const p = phone(); let sent = 0;
  const rs = await Promise.all(Array.from({ length: 10 }, () =>
    issueOtp({ phone: p, purpose: "RESET_PASSWORD", ip: "1.1.1." + Math.floor(Math.random()*200), send: async () => { sent++; } })));
  assert.equal(rs.filter((r) => r.ok).length, 1);
  assert.equal(sent, 1);
});

test("OTP is stored hashed and verifies once only", async () => {
  const p = phone(); let code;
  await issueOtp({ phone: p, purpose: "VERIFY_PHONE", ip: "2.2.2.2", send: async (c) => { code = c; } });
  const row = await prisma.otpCode.findFirst({ where: { phone: p } });
  assert.notEqual(row.code, code); assert.ok(row.code.length >= 40);
  const rs = await Promise.all(Array.from({ length: 6 }, () => verifyOtp({ phone: p, purpose: "VERIFY_PHONE", code })));
  assert.equal(rs.filter((r) => r.ok).length, 1, "correct code may be consumed exactly once");
});

test("OTP brute force: parallel guessing never exceeds max attempts", async () => {
  const p = phone(); let code;
  await issueOtp({ phone: p, purpose: "RESET_PASSWORD", ip: "3.3.3.3", send: async (c) => { code = c; } });
  const wrong = Array.from({ length: 300 }, (_, i) => String(100000 + ((Number(code) - 100000 + 1 + i) % 900000)));
  const rs = await Promise.all(wrong.map((g) => verifyOtp({ phone: p, purpose: "RESET_PASSWORD", code: g })));
  const row = await prisma.otpCode.findFirst({ where: { phone: p } });
  assert.ok(row.failedAttempts <= OTP_MAX_ATTEMPTS, "attempts=" + row.failedAttempts);
  assert.equal(row.failedAttempts, OTP_MAX_ATTEMPTS);
  assert.equal(row.used, true, "the OTP must be expired after the third incorrect guess");
  assert.equal(rs.filter((r) => r.ok).length, 0);
  // after lockout the correct code must be rejected
  const late = await verifyOtp({ phone: p, purpose: "RESET_PASSWORD", code });
  assert.equal(late.ok, false);
});

test.after(async () => { await prisma.$disconnect(); });


test("OTP policy: three initial SMS, then one SMS every three hours", async () => {
  const p = phone();
  const purpose = "RESET_PASSWORD";
  let sent = 0;
  const subject = hmacHex(p, `otp-policy:${purpose}`);
  const pKey = `otp:send-policy:${purpose}:${subject}`;
  const cKey = `otp:send-cooldown:${purpose}:${subject}`;
  const ip = (n) => `10.20.0.${n}`;
  const send = async () => { sent++; };

  for (let i = 1; i <= 3; i++) {
    const result = await issueOtp({ phone: p, purpose, ip: ip(i), send });
    assert.equal(result.ok, true, `initial SMS ${i} should be allowed`);
    // Simulate the required two-minute interval without waiting in the test.
    await prisma.rateLimitBucket.update({
      where: { key: cKey },
      data: { windowStart: new Date(Date.now() - 3 * 60 * 1000) },
    });
  }

  const blocked = await issueOtp({ phone: p, purpose, ip: ip(4), send });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "phone_cooldown");
  assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 3 * 60 * 60);
  assert.equal(sent, 3);

  // After the first three-hour lock, exactly one SMS is allowed.
  await prisma.rateLimitBucket.update({
    where: { key: pKey },
    data: { windowStart: new Date(Date.now() - 3 * 60 * 60 * 1000 - 5_000) },
  });
  await prisma.rateLimitBucket.update({
    where: { key: cKey },
    data: { windowStart: new Date(Date.now() - 3 * 60 * 1000) },
  });
  const oneAfterLock = await issueOtp({ phone: p, purpose, ip: ip(5), send });
  assert.equal(oneAfterLock.ok, true);
  assert.equal(sent, 4);

  // Every later allowed SMS starts another three-hour lock.
  await prisma.rateLimitBucket.update({
    where: { key: cKey },
    data: { windowStart: new Date(Date.now() - 3 * 60 * 1000) },
  });
  const blockedAgain = await issueOtp({ phone: p, purpose, ip: ip(6), send });
  assert.equal(blockedAgain.ok, false);
  assert.equal(blockedAgain.reason, "phone_cooldown");
  assert.equal(sent, 4);
});

test("OTP issuance limits are independent by purpose and reset after successful flow", async () => {
  const p = phone();
  const purposes = ["VERIFY_PHONE", "RESET_PASSWORD"];
  for (const purpose of purposes) {
    const result = await issueOtp({ phone: p, purpose, ip: `10.21.0.${purpose === "VERIFY_PHONE" ? 1 : 2}`, send: async () => {} });
    assert.equal(result.ok, true);
  }

  await resetOtpIssuanceState({ phone: p, purpose: "RESET_PASSWORD" });
  const resetAgain = await issueOtp({ phone: p, purpose: "RESET_PASSWORD", ip: "10.21.0.3", send: async () => {} });
  assert.equal(resetAgain.ok, true, "successful reset should clear only the reset-password counters");

  const verifyCooldown = await issueOtp({ phone: p, purpose: "VERIFY_PHONE", ip: "10.21.0.4", send: async () => {} });
  assert.equal(verifyCooldown.ok, false, "registration/phone verification state must remain independent");
  assert.equal(verifyCooldown.reason, "cooldown");
});
