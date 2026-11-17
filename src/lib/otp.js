import { prisma } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { generateOtp, hmacHex, safeEqualHex, ipBucketKey } from "@/lib/security";
import { invalidatePasswordResetGrants } from "@/lib/password-reset";

export const OTP_TTL_SECONDS = 120;
export const OTP_RESEND_COOLDOWN_SECONDS = 120;
export const OTP_MAX_ATTEMPTS = 3;
export const OTP_INITIAL_SEND_LIMIT = 3;
export const OTP_LONG_COOLDOWN_SECONDS = 3 * 60 * 60;
const hashCode = (phone, purpose, code) => hmacHex(code, `otp:${phone}:${purpose}`);

// Do not store raw phone numbers in rate-limit keys.
const subjectKey = (phone, purpose) => hmacHex(phone, `otp-policy:${purpose}`);
const policyKey = (phone, purpose) => `otp:send-policy:${purpose}:${subjectKey(phone, purpose)}`;
const cooldownKey = (phone, purpose) => `otp:send-cooldown:${purpose}:${subjectKey(phone, purpose)}`;

/**
 * Atomically reserves an OTP send slot and the 2-minute resend cooldown.
 * Per (phone, purpose): three initial sends, at least 2 minutes apart; after
 * the third, one send every 3 hours. VERIFY_PHONE and RESET_PASSWORD are separate.
 */
async function reserveOtpSend(tx, phone, purpose) {
  const pKey = policyKey(phone, purpose);
  const cKey = cooldownKey(phone, purpose);

  await tx.$executeRaw`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "updatedAt")
    VALUES
      (${pKey}, 0, ${new Date(0)}, ${new Date()}),
      (${cKey}, 0, ${new Date(0)}, ${new Date()})
    ON CONFLICT ("key") DO NOTHING
  `;

  const rows = await tx.$queryRaw`
    SELECT "key", "count"::int AS "count", "windowStart",
           NOW() AS "dbNow"
    FROM "RateLimitBucket"
    WHERE "key" IN (${pKey}, ${cKey})
    ORDER BY "key"
    FOR UPDATE
  `;

  const byKey = new Map(rows.map((row) => [row.key, row]));
  const policy = byKey.get(pKey);
  const cooldown = byKey.get(cKey);
  if (!policy || !cooldown) throw new Error("OTP_RATE_LIMIT_STATE_MISSING");

  const now = new Date(policy.dbNow).getTime();
  const sends = Number(policy.count);

  if (sends >= OTP_INITIAL_SEND_LIMIT) {
    const lockUntil = new Date(policy.windowStart).getTime()
      + OTP_LONG_COOLDOWN_SECONDS * 1000;
    if (lockUntil > now) {
      return {
        allowed: false,
        reason: "phone_cooldown",
        retryAfter: Math.max(1, Math.ceil((lockUntil - now) / 1000)),
      };
    }
  }

  const cooldownUntil = new Date(cooldown.windowStart).getTime()
    + OTP_RESEND_COOLDOWN_SECONDS * 1000;
  if (cooldown.count > 0 && cooldownUntil > now) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfter: Math.max(1, Math.ceil((cooldownUntil - now) / 1000)),
    };
  }

  await tx.$executeRaw`
    UPDATE "RateLimitBucket"
    SET "count" = 1, "windowStart" = ${policy.dbNow}, "updatedAt" = ${policy.dbNow}
    WHERE "key" = ${cKey}
  `;

  const nextCount = sends < OTP_INITIAL_SEND_LIMIT ? sends + 1 : OTP_INITIAL_SEND_LIMIT;
  await tx.$executeRaw`
    UPDATE "RateLimitBucket"
    SET "count" = ${nextCount}, "windowStart" = ${policy.dbNow}, "updatedAt" = ${policy.dbNow}
    WHERE "key" = ${pKey}
  `;

  return {
    allowed: true,
    reservedAt: policy.dbNow,
    nextRequestInSeconds: nextCount >= OTP_INITIAL_SEND_LIMIT
      ? OTP_LONG_COOLDOWN_SECONDS
      : OTP_RESEND_COOLDOWN_SECONDS,
  };
}

/** Clear phone/purpose send state only after that flow succeeds. */
export async function resetOtpIssuanceState({ phone, purpose, tx = prisma }) {
  await tx.rateLimitBucket.deleteMany({
    where: { key: { in: [policyKey(phone, purpose), cooldownKey(phone, purpose)] } },
  });
}

/**
 * Issue an OTP. The IP limit remains a separate anti-abuse layer. Phone/purpose
 * send slots are reserved transactionally before calling the SMS provider.
 */
export async function issueOtp({ phone, purpose, ip, send }) {
  const ipLimit = await consumeRateLimit(`otp:ip:${ipBucketKey(ip)}`, 20, 3600);
  if (!ipLimit.allowed) {
    return { ok: false, status: 429, reason: "ip_limit", retryAfter: ipLimit.retryAfter };
  }

  const code = generateOtp();
  const reservation = await prisma.$transaction(async (tx) => {
    const slot = await reserveOtpSend(tx, phone, purpose);
    if (!slot.allowed) return slot;

    if (purpose === "RESET_PASSWORD") {
      // Only a newly reserved send invalidates an older reset authorization.
      // A rate-limited request must not revoke a grant the user already earned.
      await invalidatePasswordResetGrants(phone, tx);
    }

    await tx.otpCode.updateMany({
      where: { phone, purpose, used: false },
      data: { used: true },
    });
    const record = await tx.otpCode.create({
      data: {
        phone,
        purpose,
        code: hashCode(phone, purpose, code),
        expiresAt: new Date(new Date(slot.reservedAt).getTime() + OTP_TTL_SECONDS * 1000),
      },
    });
    return { ...slot, record };
  });

  if (!reservation.allowed) {
    return {
      ok: false,
      status: 429,
      reason: reservation.reason,
      retryAfter: reservation.retryAfter,
    };
  }

  try {
    await send(code);
  } catch (err) {
    // Provider timeouts are ambiguous: it may already have accepted the SMS.
    // Keep the send slot/cooldown to prevent duplicate sends and quota bypass.
    await prisma.otpCode.update({
      where: { id: reservation.record.id },
      data: { used: true },
    }).catch(() => {});
    console.error("OTP_SMS_SEND_FAILED:", err?.code || err?.name || "error");
    return {
      ok: false,
      status: 502,
      reason: "sms_failed",
      nextRequestInSeconds: reservation.nextRequestInSeconds,
    };
  }

  return {
    ok: true,
    recordId: reservation.record.id,
    expiresInSeconds: OTP_TTL_SECONDS,
    nextRequestInSeconds: reservation.nextRequestInSeconds,
  };
}

/**
 * Serialize OTP verification on the OTP row. Only incorrect guesses consume
 * attempts; a correct code is claimed once. The row lock prevents a set of
 * concurrent wrong guesses from invalidating a correct request already in flight.
 */
export async function verifyOtp({ phone, purpose, code, tx = null }) {
  const verifyWithClient = async (client) => {
    const rows = await client.$queryRaw`
      SELECT "id", "code", "failedAttempts"::int AS "failedAttempts"
      FROM "OtpCode"
      WHERE "phone" = ${phone}
        AND "purpose" = ${purpose}::"OtpPurpose"
        AND "used" = false
        AND "expiresAt" > NOW()
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return { ok: false, reason: "invalid_or_expired" };

    if (!safeEqualHex(row.code, hashCode(phone, purpose, String(code)))) {
      const failedAttempts = Number(row.failedAttempts) + 1;
      await client.otpCode.update({
        where: { id: row.id },
        data: {
          failedAttempts,
          ...(failedAttempts >= OTP_MAX_ATTEMPTS ? { used: true } : {}),
        },
      });
      return {
        ok: false,
        reason: "invalid_or_expired",
        attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - failedAttempts),
      };
    }

    await client.otpCode.update({
      where: { id: row.id },
      data: { used: true },
    });
    return { ok: true, otpId: row.id };
  };

  return tx ? verifyWithClient(tx) : prisma.$transaction(verifyWithClient);
}

export async function cleanupOtps() {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const r = await prisma.otpCode.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  return r.count;
}
