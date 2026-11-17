import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  LOGIN_STEP_UP_THRESHOLD,
  recordPhoneLoginFailure,
  requiresLoginStepUp,
  resetPhoneLoginFailures,
} from "@/lib/login-security";

const testKey = () => `test:${randomUUID()}`.padEnd(40, "x");

test("parallel login failures are counted atomically and request step-up without locking the account", async () => {
  const phoneKey = testKey();
  try {
    await Promise.all(Array.from({ length: 20 }, () => recordPhoneLoginFailure(phoneKey)));
    const row = await prisma.loginAttempt.findUnique({ where: { phoneKey } });
    assert.equal(row.failedAttempts, LOGIN_STEP_UP_THRESHOLD);
    assert.equal(row.blockedUntil, null, "phone-wide lockouts must never be set");
    assert.equal(await requiresLoginStepUp(phoneKey), true);
  } finally {
    await resetPhoneLoginFailures(phoneKey);
  }
});

test("expired failure window stops requiring step-up and starts a fresh count", async () => {
  const phoneKey = testKey();
  try {
    for (let i = 0; i < LOGIN_STEP_UP_THRESHOLD; i += 1) {
      await recordPhoneLoginFailure(phoneKey);
    }
    assert.equal(await requiresLoginStepUp(phoneKey), true);

    await prisma.$executeRaw`
      UPDATE "LoginAttempt"
      SET "windowStartedAt" = (NOW() AT TIME ZONE 'UTC') - INTERVAL '16 minutes'
      WHERE "phoneKey" = ${phoneKey}
    `;
    assert.equal(await requiresLoginStepUp(phoneKey), false);
    assert.equal(await recordPhoneLoginFailure(phoneKey), 1);
    assert.equal(await requiresLoginStepUp(phoneKey), false);
  } finally {
    await resetPhoneLoginFailures(phoneKey);
  }
});

test("successful verification reset clears only the matching phone risk row", async () => {
  const phoneKey = testKey();
  const otherKey = testKey();
  try {
    await recordPhoneLoginFailure(phoneKey);
    await recordPhoneLoginFailure(otherKey);
    assert.equal(await resetPhoneLoginFailures(phoneKey), 1);
    assert.equal(await prisma.loginAttempt.findUnique({ where: { phoneKey } }), null);
    assert.ok(await prisma.loginAttempt.findUnique({ where: { phoneKey: otherKey } }));
  } finally {
    await resetPhoneLoginFailures(phoneKey);
    await resetPhoneLoginFailures(otherKey);
  }
});

test.after(async () => { await prisma.$disconnect(); });
