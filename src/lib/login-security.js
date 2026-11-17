import { prisma } from "@/lib/db";

// Count failed passwords in a fixed 15-minute phone window. Reaching the
// threshold requests step-up verification only after the correct password;
// it never blocks the account or rejects a correct password by itself.
export const LOGIN_FAILURE_WINDOW_SECONDS = 15 * 60;
export const LOGIN_STEP_UP_THRESHOLD = 5;

function assertPhoneKey(phoneKey) {
  if (typeof phoneKey !== "string" || phoneKey.length < 32 || phoneKey.length > 128) {
    throw new TypeError("Invalid login phone key");
  }
}

/** Atomically record a failed password, safe across app workers and races. */
export async function recordPhoneLoginFailure(phoneKey, tx = prisma) {
  assertPhoneKey(phoneKey);
  const rows = await tx.$queryRaw`
    INSERT INTO "LoginAttempt" (
      "phoneKey", "failedAttempts", "windowStartedAt", "blockedUntil", "updatedAt"
    )
    VALUES (
      ${phoneKey}, 1, (NOW() AT TIME ZONE 'UTC'), NULL, (NOW() AT TIME ZONE 'UTC')
    )
    ON CONFLICT ("phoneKey") DO UPDATE SET
      "failedAttempts" = CASE
        WHEN "LoginAttempt"."windowStartedAt" <=
          (NOW() AT TIME ZONE 'UTC') - (${LOGIN_FAILURE_WINDOW_SECONDS}::int * INTERVAL '1 second')
          THEN 1
        ELSE LEAST("LoginAttempt"."failedAttempts" + 1, ${LOGIN_STEP_UP_THRESHOLD}::int)
      END,
      "windowStartedAt" = CASE
        WHEN "LoginAttempt"."windowStartedAt" <=
          (NOW() AT TIME ZONE 'UTC') - (${LOGIN_FAILURE_WINDOW_SECONDS}::int * INTERVAL '1 second')
          THEN (NOW() AT TIME ZONE 'UTC')
        ELSE "LoginAttempt"."windowStartedAt"
      END,
      -- Deliberately do not globally lock a phone/account.
      "blockedUntil" = NULL,
      "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    RETURNING "failedAttempts"::int AS "failedAttempts"
  `;
  return Number(rows[0]?.failedAttempts ?? 0);
}

/** Only signals step-up after the user has already supplied the right password. */
export async function requiresLoginStepUp(phoneKey, tx = prisma) {
  assertPhoneKey(phoneKey);
  const rows = await tx.$queryRaw`
    SELECT EXISTS (
      SELECT 1
      FROM "LoginAttempt"
      WHERE "phoneKey" = ${phoneKey}
        AND "failedAttempts" >= ${LOGIN_STEP_UP_THRESHOLD}::int
        AND "windowStartedAt" >
          (NOW() AT TIME ZONE 'UTC') - (${LOGIN_FAILURE_WINDOW_SECONDS}::int * INTERVAL '1 second')
    ) AS "required"
  `;
  return rows[0]?.required === true;
}

/** Clear the phone's risk history only after a successful authenticated flow. */
export async function resetPhoneLoginFailures(phoneKey, tx = prisma) {
  assertPhoneKey(phoneKey);
  const result = await tx.loginAttempt.deleteMany({ where: { phoneKey } });
  return result.count;
}
