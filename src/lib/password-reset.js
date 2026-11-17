import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { hmacHex } from "@/lib/security";
import { signPasswordResetToken } from "@/lib/session";

const GRANT_PREFIX = "password-reset:grant";

function subjectPrefix(phone) {
  return `${GRANT_PREFIX}:${hmacHex(phone, "password-reset-subject")}:`;
}

export function passwordResetGrantKey(phone, grantId) {
  return `${subjectPrefix(phone)}${hmacHex(grantId, `password-reset-grant:${phone}`)}`;
}

/** Revoke all outstanding one-time reset grants for a phone number. */
export async function invalidatePasswordResetGrants(phone, tx = prisma) {
  await tx.rateLimitBucket.deleteMany({
    where: { key: { startsWith: subjectPrefix(phone) } },
  });
}

/**
 * Create a short-lived, single-use grant after the reset OTP is verified.
 * The JWT cookie alone is insufficient: the matching DB row must also exist.
 */
export async function createPasswordResetGrant({ user, tx = prisma }) {
  const grantId = randomUUID();
  await invalidatePasswordResetGrants(user.phone, tx);
  await tx.rateLimitBucket.create({
    data: {
      key: passwordResetGrantKey(user.phone, grantId),
      count: 1,
      windowStart: new Date(),
      updatedAt: new Date(),
    },
  });
  return signPasswordResetToken(user, grantId);
}

/** Atomically consume the grant. Exactly one concurrent request can succeed. */
export async function consumePasswordResetGrant({ phone, grantId, tx = prisma }) {
  if (!phone || !grantId) return false;
  const result = await tx.rateLimitBucket.deleteMany({
    where: { key: passwordResetGrantKey(phone, grantId) },
  });
  return result.count === 1;
}

export async function hasPasswordResetGrant({ phone, grantId, tx = prisma }) {
  if (!phone || !grantId) return false;
  const row = await tx.rateLimitBucket.findUnique({
    where: { key: passwordResetGrantKey(phone, grantId) },
    select: { key: true },
  });
  return Boolean(row);
}
