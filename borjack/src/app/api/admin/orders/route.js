import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdminOrManager } from "../../../../lib/auth";
import { createAuditLog } from "../../../../lib/auditLog";

export async function GET() {
  const { session, error } = await requireAdminOrManager();
  if (error) return error;

  const orders = await prisma.order.findMany({
    include: {
      user: { select: { id: true, name: true, identifier: true } },
      items: { include: { product: { select: { title: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function PATCH(req) {
  const { session, error } = await requireAdminOrManager();
  if (error) return error;

  const { orderId, status } = await req.json();

  const before = await prisma.order.findUnique({ where: { id: orderId } });

  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  await createAuditLog({
    userId: session.id,
    action: "UPDATE_ORDER_STATUS",
    entityType: "Order",
    entityId: orderId,
    description: `تغییر وضعیت سفارش #${orderId} از ${before?.status} به ${status}`,
    oldValue: { status: before?.status },
    newValue: { status },
  });

  return NextResponse.json({ order });
}