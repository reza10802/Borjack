import { prisma } from "@/lib/db";

// Atomic fixed-window counter stored in Postgres (works across processes/containers).
export async function consumeRateLimit(key, limit, windowSeconds) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "RateLimitBucket" ("key","count","windowStart","updatedAt")
    VALUES (${key}, 1, (NOW() AT TIME ZONE 'UTC'), (NOW() AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" <= (NOW() AT TIME ZONE 'UTC') - (${windowSeconds}::int * INTERVAL '1 second')
                     THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."windowStart" <= (NOW() AT TIME ZONE 'UTC') - (${windowSeconds}::int * INTERVAL '1 second')
                     THEN (NOW() AT TIME ZONE 'UTC') ELSE "RateLimitBucket"."windowStart" END,
      "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    RETURNING "count"::int AS "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStart" + (${windowSeconds}::int * INTERVAL '1 second') - (NOW() AT TIME ZONE 'UTC'))))::int) AS "retryAfter"`;
  const { count, retryAfter } = rows[0];
  return { allowed: count <= limit, count, retryAfter };
}

export async function resetRateLimit(key) {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export async function cleanupRateLimits(olderThanSeconds = 172800) {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  // Keep incomplete OTP-flow counters until the user completes registration/reset.
  const r = await prisma.rateLimitBucket.deleteMany({
    where: {
      windowStart: { lt: cutoff },
      NOT: { key: { startsWith: "otp:send-policy:" } },
    },
  });
  return r.count;
}

// Read-only check (does not consume). Use together with consumeRateLimit on failures.
export async function peekRateLimit(key, limit, windowSeconds) {
  const rows = await prisma.$queryRaw`
    SELECT "count"::int AS "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("windowStart" + (${windowSeconds}::int * INTERVAL '1 second') - (NOW() AT TIME ZONE 'UTC'))))::int) AS "retryAfter"
    FROM "RateLimitBucket"
    WHERE "key" = ${key} AND "windowStart" > (NOW() AT TIME ZONE 'UTC') - (${windowSeconds}::int * INTERVAL '1 second')`;
  const r = rows[0];
  return r && r.count >= limit ? { blocked: true, retryAfter: r.retryAfter } : { blocked: false, retryAfter: 0 };
}
