import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";
import { OrderStatus, PaymentStatus } from "@/generated/prisma";

// منیجر فقط این انتقال‌ها را مجاز است انجام دهد
const MANAGER_ALLOWED_TRANSITIONS = {
  [OrderStatus.PROCESSING]: [OrderStatus.READY_TO_SHIP],
  [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// PATCH /api/admin/orders/[id] — تغییر وضعیت سفارش
export async function PATCH(req, { params }) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const orderId = Number((await params).id);

    if (!orderId) {
      return NextResponse.json(
        { error: "شناسه سفارش نامعتبر است" },
        { status: 400 },
      );
    }

    const { status } = await req.json();
    if (!Object.values(OrderStatus).includes(status)) {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }

    const before = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, title: true, image: true } },
          },
        },
      },
    });

    if (!before) {
      return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    }

    if (before.paymentStatus !== PaymentStatus.PAID) {
      return NextResponse.json(
        {
          error: "این سفارش هنوز پرداخت نشده است.",
        },
        {
          status: 400,
        },
      );
    }

    if (before.status === status) {
      return NextResponse.json(
        {
          error: "سفارش همین الان در همین وضعیت قرار دارد.",
        },
        {
          status: 400,
        },
      );
    }

    // محدودیت منیجر
    if (check.user.role === "MANAGER") {
      const allowedNextStatuses =
        MANAGER_ALLOWED_TRANSITIONS[before.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        return NextResponse.json(
          {
            error:
              "شما اجازه این تغییر وضعیت را ندارید. منیجر فقط می‌تواند سفارش را مرحله‌به‌مرحله جلو ببرد.",
          },
          { status: 403 },
        );
      }
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                image: true,
              },
            },
          },
        },
      },
    });

    await logAction({
      userId: check.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "Order",
      entityId: String(orderId),
      description: `وضعیت سفارش #${orderId} از ${before.status} به ${status} تغییر کرد`,
      oldValue: { status: before.status },
      newValue: { status },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در به‌روزرسانی سفارش" },
      { status: 500 },
    );
  }
}
