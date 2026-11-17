import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

// Orders/payments that need manual attention (refunds, stock issues, superseded authorities).
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const [orders, attempts] = await Promise.all([
    prisma.order.findMany({
      where: { paymentStatus: "PAID", OR: [{ stockReservationStatus: "ISSUE" }, { status: "CANCELLED" }] },
      select: { id: true, total: true, status: true, stockReservationStatus: true, paidAt: true, refId: true, userId: true },
      orderBy: { paidAt: "desc" },
      take: 100,
    }),
    prisma.paymentAttempt.findMany({
      where: { status: "REVIEW" },
      select: { id: true, orderId: true, amount: true, refId: true, note: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return NextResponse.json({ paidNeedsRefundOrReview: orders, attemptsNeedingReview: attempts });
}
