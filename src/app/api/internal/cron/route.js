import { NextResponse } from "next/server";
import { performance } from "node:perf_hooks";
import { prisma } from "@/lib/db";
import { reconcileExpiredOrders } from "@/lib/payment-recon";
import { cleanupOtps } from "@/lib/otp";
import { cleanupRateLimits } from "@/lib/rate-limit";
import { safeEqualSecret } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Self-hosted VPS may ignore this; keep the handler itself bounded regardless.
export const maxDuration = 100;

const RECONCILE_TIME_BUDGET_MS = 65_000;
const RECONCILE_LEASE_MS = 90_000;

// Scheduled maintenance: reconcile expired reservations and purge ephemeral data.
// Block /api/internal/ from the public internet in nginx.
export async function POST(req) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || secret.length < 32 || !safeEqualSecret(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const startedAt = performance.now();
  try {
    const reconcile = await reconcileExpiredOrders({
      limit: 20,
      timeBudgetMs: RECONCILE_TIME_BUDGET_MS,
      leaseMs: RECONCILE_LEASE_MS,
    });
    const otpRows = await cleanupOtps();
    const rateRows = await cleanupRateLimits();
    const loginRows = await prisma.loginAttempt
      .deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - 3600 * 1000) } } })
      .then((r) => r.count)
      .catch(() => 0);

    return NextResponse.json({
      ok: true,
      reconcile,
      cleaned: { otp: otpRows, rateLimit: rateRows, loginAttempt: loginRows },
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    console.error("CRON_ERROR", error?.name, error?.code);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
