import { randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/db";
import {
  ZARINPAL_GATEWAY_NAME,
  ZARINPAL_INQUIRY_URL,
  ZARINPAL_VERIFY_URL,
  assertGatewayConfig,
  toZarinpalAmount,
} from "@/lib/zarinpal";
import { lockAndGetOrder, releaseReservationSafely, settlePaidOrder } from "@/lib/payment-settlement";

export const RECONCILE_GRACE_MS = Number(process.env.RESERVATION_RELEASE_GRACE_SECONDS ?? 120) * 1000;

// Keep each gateway call short enough that an Inquiry + Verify pair fits inside
// the reconciliation budget. A timeout is UNKNOWN, never proof of non-payment.
const GATEWAY_TIMEOUT_MS = 10_000;
const DEFAULT_BATCH_LIMIT = 20;
const MAX_BATCH_LIMIT = 50;
const DEFAULT_TIME_BUDGET_MS = 65_000;
const DEFAULT_LEASE_MS = 90_000;
const MAX_CANDIDATE_SCAN = 250;
const RETRY_BASE_MS = 5 * 60_000;
const RETRY_MAX_MS = 6 * 60 * 60_000;
const RETRY_KEY_PREFIX = "recon:retry:";
const LEASE_KEY_PREFIX = "recon:lease:";

function extractErrorCode(body) {
  const values = [];
  const visit = (value) => {
    if (typeof value === "string" && /^-\d+$/.test(value.trim())) values.push(Number(value));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(body?.errors);
  return values.find(Number.isFinite) ?? null;
}

async function postGatewayJson(url, payload) {
  assertGatewayConfig();
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;
  if (!merchantId) return { ok: false, code: "NO_MERCHANT_ID", body: null };

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      body: JSON.stringify({ merchant_id: merchantId, ...payload }),
    });
  } catch (error) {
    return { ok: false, code: error?.name === "TimeoutError" ? "TIMEOUT" : "NETWORK", body: null };
  }

  const body = await response.json().catch(() => null);
  return {
    ok: Boolean(response.ok),
    code: extractErrorCode(body),
    body,
  };
}

/**
 * Inquiry only reports the gateway state. It is not payment verification.
 * It accepts merchant_id + authority (no amount).
 * Returns PAID, VERIFIED, IN_BANK, FAILED, REVERSED or UNKNOWN.
 */
export async function inquireAuthority({ authority }) {
  if (typeof authority !== "string" || !authority.trim()) {
    return { state: "UNKNOWN", code: "INVALID_AUTHORITY_INPUT" };
  }

  const result = await postGatewayJson(ZARINPAL_INQUIRY_URL, { authority });
  if (!result.ok) return { state: "UNKNOWN", code: result.code ?? "INQUIRY_ERROR" };

  const status = String(result.body?.data?.status ?? "").trim().toUpperCase();
  if (["PAID", "VERIFIED", "IN_BANK", "FAILED", "REVERSED"].includes(status)) {
    return { state: status, code: result.body?.data?.code ?? null };
  }

  return { state: "UNKNOWN", code: result.code ?? result.body?.data?.code ?? "UNKNOWN_INQUIRY_STATUS" };
}

/**
 * Verify is called only after Inquiry says PAID or VERIFIED.
 * 100 = newly verified, 101 = already verified. Other responses stay UNKNOWN.
 */
export async function verifyAuthority({ authority, total }) {
  if (typeof authority !== "string" || !authority.trim()) {
    return { state: "UNKNOWN", code: "INVALID_AUTHORITY_INPUT" };
  }

  let amount;
  try {
    amount = toZarinpalAmount(total);
  } catch {
    return { state: "UNKNOWN", code: "INVALID_AMOUNT" };
  }

  const result = await postGatewayJson(ZARINPAL_VERIFY_URL, { authority, amount });
  if (!result.ok) return { state: "UNKNOWN", code: result.code ?? "VERIFY_ERROR" };

  const verifyCode = Number(result.body?.data?.code);
  if (verifyCode === 100 || verifyCode === 101) {
    return {
      state: "PAID",
      code: verifyCode,
      refId: result.body?.data?.ref_id != null ? String(result.body.data.ref_id) : null,
    };
  }

  return { state: "UNKNOWN", code: result.code ?? (Number.isFinite(verifyCode) ? verifyCode : "UNKNOWN_VERIFY_RESPONSE") };
}

/** Safe combined flow: Inquiry first; Verify only for PAID/VERIFIED. */
export async function confirmAuthorityPayment({ authority, total }) {
  const inquiry = await inquireAuthority({ authority });

  if (inquiry.state === "FAILED") {
    return { state: "UNPAID", inquiryStatus: "FAILED", code: inquiry.code };
  }
  if (inquiry.state === "REVERSED") {
    return { state: "REVERSED", inquiryStatus: "REVERSED", code: inquiry.code };
  }
  if (inquiry.state === "IN_BANK") {
    return { state: "UNKNOWN", inquiryStatus: "IN_BANK", code: inquiry.code };
  }
  if (inquiry.state !== "PAID" && inquiry.state !== "VERIFIED") {
    return { state: "UNKNOWN", inquiryStatus: inquiry.state, code: inquiry.code };
  }

  const verification = await verifyAuthority({ authority, total });
  if (verification.state !== "PAID") {
    return {
      state: "UNKNOWN",
      inquiryStatus: inquiry.state,
      verifyCode: verification.code,
    };
  }

  return {
    state: "PAID",
    inquiryStatus: inquiry.state,
    code: verification.code,
    refId: verification.refId,
  };
}

async function markAuthorityForReview(authority, note) {
  if (!authority) return;
  await prisma.paymentAttempt.updateMany({
    where: { authority, status: "PENDING" },
    data: { status: "REVIEW", note },
  });
}

async function releaseExpired(order, note) {
  return prisma.$transaction(async (tx) => {
    const latest = await lockAndGetOrder(tx, order.id, order.userId);
    if (
      !latest || latest.paymentStatus !== "PENDING" || latest.stockReservationStatus !== "RESERVED" ||
      latest.authority !== order.authority || !latest.paymentExpiresAt ||
      latest.paymentExpiresAt.getTime() > Date.now() - RECONCILE_GRACE_MS
    ) return "SKIPPED";

    const released = await releaseReservationSafely(tx, latest);
    if (!released) return "INTEGRITY_ISSUE";
    if (latest.transaction) {
      await tx.transaction.updateMany({
        where: { orderId: latest.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
    }
    if (latest.authority) {
      await tx.paymentAttempt.updateMany({
        where: { authority: latest.authority, status: "PENDING" },
        data: { status: "EXPIRED", note },
      });
    }
    return "RELEASED";
  });
}

/** Reconcile one expired reservation. Only Inquiry=FAILED permits automatic release. */
export async function reconcileOrder(order) {
  if (order.paymentStatus !== "PENDING" || order.stockReservationStatus !== "RESERVED") {
    return "SKIPPED";
  }

  if (!order.authority) {
    // Crash between reservation and authority persistence: nothing was sent to the gateway.
    return releaseExpired(order, "expired without authority");
  }

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { authority: order.authority },
    select: { status: true },
  });
  if (attempt?.status === "REVIEW") return "REVIEW_REQUIRED";

  const gateway = await confirmAuthorityPayment({ authority: order.authority, total: order.total });
  if (gateway.state === "PAID") {
    const transaction = order.transaction;
    if (transaction && (
      transaction.authority !== order.authority ||
      transaction.gateway !== ZARINPAL_GATEWAY_NAME ||
      Number(transaction.amount) !== Number(order.total)
    )) {
      await markAuthorityForReview(order.authority, "Payment reconciliation mismatch: authority, gateway or amount differs from the order transaction");
      return "MISMATCH";
    }

    const settlement = await settlePaidOrder({ order, authority: order.authority, refId: gateway.refId ?? transaction?.refId ?? null });
    return settlement === "STOCK_ISSUE" ? "SETTLED_STOCK_ISSUE" : "SETTLED";
  }

  if (gateway.state === "UNPAID") {
    return releaseExpired(order, "expired; ZarinPal Inquiry status FAILED");
  }

  if (gateway.state === "REVERSED") {
    await markAuthorityForReview(order.authority, "ZarinPal Inquiry status REVERSED; manual financial review required");
    return "REVERSED_REVIEW";
  }

  return "UNKNOWN_KEEP";
}

function clampInteger(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function retryKey(orderId) {
  return `${RETRY_KEY_PREFIX}${orderId}`;
}

function leaseKey(orderId) {
  return `${LEASE_KEY_PREFIX}${orderId}`;
}

/**
 * Persist the next retry time in the existing RateLimitBucket table.
 * windowStart is used as nextRetryAt for this private key namespace; no schema
 * migration is needed. Backoff: 5m, 10m, 20m ... capped at 6 hours.
 */
async function scheduleRetry(orderId) {
  const key = retryKey(orderId);
  await prisma.$executeRaw`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "updatedAt")
    VALUES (
      ${key},
      1,
      (NOW() AT TIME ZONE 'UTC') + (${RETRY_BASE_MS}::double precision * INTERVAL '1 millisecond'),
      (NOW() AT TIME ZONE 'UTC')
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = LEAST("RateLimitBucket"."count" + 1, 31),
      "windowStart" = (NOW() AT TIME ZONE 'UTC') + (
        LEAST(
          ${RETRY_BASE_MS}::double precision * POWER(2, LEAST("RateLimitBucket"."count", 20)),
          ${RETRY_MAX_MS}::double precision
        ) * INTERVAL '1 millisecond'
      ),
      "updatedAt" = (NOW() AT TIME ZONE 'UTC')
  `;
}

async function clearRetry(orderId) {
  await prisma.rateLimitBucket.deleteMany({ where: { key: retryKey(orderId) } });
}

/**
 * Acquire a per-order database lease. The random token prevents an expired
 * worker from deleting a newer worker's lease when it eventually exits.
 */
async function acquireOrderLease(orderId, leaseMs) {
  const key = leaseKey(orderId);
  const token = randomInt(1, 2_147_483_647);
  const rows = await prisma.$queryRaw`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "updatedAt")
    VALUES (
      ${key},
      ${token},
      (NOW() AT TIME ZONE 'UTC') + (${leaseMs}::int * INTERVAL '1 millisecond'),
      (NOW() AT TIME ZONE 'UTC')
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = EXCLUDED."count",
      "windowStart" = EXCLUDED."windowStart",
      "updatedAt" = (NOW() AT TIME ZONE 'UTC')
    WHERE "RateLimitBucket"."windowStart" <= (NOW() AT TIME ZONE 'UTC')
    RETURNING "key"
  `;
  return rows.length ? { key, token } : null;
}

async function releaseOrderLease(lease) {
  if (!lease) return;
  await prisma.rateLimitBucket.deleteMany({ where: { key: lease.key, count: lease.token } });
}

const RETRYABLE_RESULTS = new Set(["UNKNOWN_KEEP", "ERROR"]);
const REVIEW_RESULTS = new Set(["MISMATCH", "INTEGRITY_ISSUE", "SETTLED_STOCK_ISSUE"]);

/**
 * Reconcile a bounded batch of expired orders.
 * - Orders with a future nextRetryAt are excluded in SQL (no head-of-line blocking).
 * - Each order is protected by a database lease across overlapping Cron runs.
 * - Unknown/network errors get exponential backoff.
 * - The loop stops at its wall-clock budget; gateway calls have a hard timeout.
 */
export async function reconcileExpiredOrders({
  limit = DEFAULT_BATCH_LIMIT,
  userId,
  timeBudgetMs = DEFAULT_TIME_BUDGET_MS,
  leaseMs = DEFAULT_LEASE_MS,
} = {}) {
  const startedAt = performance.now();
  const batchLimit = clampInteger(limit, DEFAULT_BATCH_LIMIT, 0, MAX_BATCH_LIMIT);
  const budget = clampInteger(timeBudgetMs, DEFAULT_TIME_BUDGET_MS, 0, 80_000);
  const leaseDuration = clampInteger(leaseMs, DEFAULT_LEASE_MS, 30_000, 180_000);

  if (batchLimit === 0 || budget === 0) {
    return {
      processed: 0,
      summary: {},
      deferredByLease: 0,
      deferredByBudget: false,
      timeBudgetExceeded: budget === 0,
      hasMore: batchLimit > 0,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const cutoff = new Date(Date.now() - RECONCILE_GRACE_MS);
  const userFilter = typeof userId === "string" ? userId : "";
  const candidateLimit = Math.min(Math.max(batchLimit * 5, batchLimit + 1), MAX_CANDIDATE_SCAN);
  const candidates = await prisma.$queryRaw`
    SELECT o."id"
    FROM "Order" AS o
    LEFT JOIN "RateLimitBucket" AS retry
      ON retry."key" = ${RETRY_KEY_PREFIX} || o."id"::text
    LEFT JOIN "RateLimitBucket" AS lease
      ON lease."key" = ${LEASE_KEY_PREFIX} || o."id"::text
    LEFT JOIN "PaymentAttempt" AS attempt
      ON attempt."authority" = o."authority"
    WHERE o."stockReservationStatus" = 'RESERVED'
      AND o."paymentStatus" = 'PENDING'
      AND o."paymentExpiresAt" IS NOT NULL
      AND o."paymentExpiresAt" < ${cutoff}
      AND (${userFilter}::text = '' OR o."userId" = ${userFilter}::text)
      AND (retry."key" IS NULL OR retry."windowStart" <= (NOW() AT TIME ZONE 'UTC'))
      AND (lease."key" IS NULL OR lease."windowStart" <= (NOW() AT TIME ZONE 'UTC'))
      AND (attempt."status" IS DISTINCT FROM 'REVIEW')
    ORDER BY o."paymentExpiresAt" ASC, o."id" ASC
    LIMIT ${candidateLimit}
  `;

  const candidateIds = candidates.map((row) => Number(row.id));
  if (!candidateIds.length) {
    return {
      processed: 0,
      summary: {},
      deferredByLease: 0,
      deferredByBudget: false,
      timeBudgetExceeded: false,
      hasMore: false,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const fetchedOrders = await prisma.order.findMany({
    where: { id: { in: candidateIds } },
    include: { transaction: true, items: true },
  });
  const byId = new Map(fetchedOrders.map((order) => [order.id, order]));
  const orders = candidateIds.map((id) => byId.get(id)).filter(Boolean);
  const summary = {};
  let processed = 0;
  let deferredByLease = 0;
  let timeBudgetExceeded = false;
  let deferredByBudget = false;
  let visited = 0;

  for (let index = 0; index < orders.length && processed < batchLimit; index += 1) {
    if (performance.now() - startedAt >= budget) {
      timeBudgetExceeded = true;
      break;
    }

    visited += 1;
    const order = orders[index];
    let lease;
    try {
      lease = await acquireOrderLease(order.id, leaseDuration);
    } catch (error) {
      // If the lease store is unavailable, fail closed: do not contact the gateway.
      summary.LEASE_ERROR = (summary.LEASE_ERROR || 0) + 1;
      console.error("RECONCILE_LEASE_ERROR", { orderId: order.id, name: error?.name, code: error?.code });
      deferredByLease += 1;
      continue;
    }

    if (!lease) {
      deferredByLease += 1;
      continue;
    }

    if (performance.now() - startedAt >= budget) {
      timeBudgetExceeded = true;
      deferredByBudget = true;
      try {
        await releaseOrderLease(lease);
      } catch (error) {
        console.error("RECONCILE_LEASE_RELEASE_ERROR", { orderId: order.id, name: error?.name, code: error?.code });
      }
      break;
    }

    processed += 1;
    let result;
    try {
      result = await reconcileOrder(order);
      if (RETRYABLE_RESULTS.has(result)) await scheduleRetry(order.id);
      else await clearRetry(order.id);

      if (REVIEW_RESULTS.has(result)) {
        await markAuthorityForReview(order.authority, `Automatic reconciliation stopped for manual review: ${result}`);
      }
    } catch (error) {
      result = "ERROR";
      try {
        await scheduleRetry(order.id);
      } catch (retryError) {
        console.error("RECONCILE_RETRY_SCHEDULE_ERROR", { orderId: order.id, name: retryError?.name, code: retryError?.code });
      }
      console.error("RECONCILE_ERROR", { orderId: order.id, name: error?.name, code: error?.code });
    } finally {
      try {
        await releaseOrderLease(lease);
      } catch (error) {
        // Lease expires automatically. Keep the next run safe rather than failing
        // the whole Cron response because cleanup of this ephemeral lock failed.
        console.error("RECONCILE_LEASE_RELEASE_ERROR", { orderId: order.id, name: error?.name, code: error?.code });
      }
    }

    summary[result] = (summary[result] || 0) + 1;
  }

  if (performance.now() - startedAt >= budget) timeBudgetExceeded = true;
  const hasMore = deferredByBudget || visited < orders.length || candidates.length >= candidateLimit;

  return {
    processed,
    summary,
    deferredByLease,
    deferredByBudget,
    timeBudgetExceeded,
    hasMore,
    durationMs: Math.round(performance.now() - startedAt),
  };
}
