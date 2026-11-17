import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { consumeRateLimit, peekRateLimit } from "@/lib/rate-limit";

const THRESHOLD = 3;
const WINDOW_SECONDS = 15 * 60;

test("login CAPTCHA is required after the third failed password attempt from an IP bucket", async () => {
  const key = `test:login:captcha:${randomUUID()}`;
  try {
    for (let attempt = 1; attempt <= THRESHOLD; attempt += 1) {
      const result = await consumeRateLimit(key, THRESHOLD, WINDOW_SECONDS);
      assert.equal(result.count, attempt);
      const state = await peekRateLimit(key, THRESHOLD, WINDOW_SECONDS);
      assert.equal(state.blocked, attempt >= THRESHOLD);
    }

    const afterThreshold = await consumeRateLimit(key, THRESHOLD, WINDOW_SECONDS);
    assert.equal(afterThreshold.allowed, false);
    assert.equal((await peekRateLimit(key, THRESHOLD, WINDOW_SECONDS)).blocked, true);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  }
});

test.after(async () => { await prisma.$disconnect(); });
