import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";

const VALID_STATUSES = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

// منیجر فقط این انتقال‌ها را مجاز است انجام دهد
const MANAGER_ALLOWED_TRANSITIONS = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["READY_TO_SHIP"],
  READY_TO_SHIP: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// PATCH /api/admin/orders/[id] — تغییر وضعیت سفارش
export async function PATCH(req, { params }) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const id = Number(params.id);
    if (!id) {
      return NextResponse.json({ error: "شناسه سفارش نامعتبر است" }, { status: 400 });
    }

    const { status } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }

    const before = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, identifier: true } },
        items: { include: { product: { select: { id: true, title: true, image: true } } } },
      },
    });

    if (!before) {
      return NextResponse.json({ error: "سفارش پیدا نشد" }, { status: 404 });
    }

    // محدودیت منیجر
    if (check.user.role === "MANAGER") {
      const allowedNextStatuses = MANAGER_ALLOWED_TRANSITIONS[before.status] || [];

      if (!allowedNextStatuses.includes(status)) {
        return NextResponse.json(
          {
            error:
              "شما اجازه این تغییر وضعیت را ندارید. منیجر فقط می‌تواند سفارش را مرحله‌به‌مرحله جلو ببرد.",
          },
          { status: 403 }
        );
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        user: { select: { id: true, name: true, identifier: true } },
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

    await logAction(req, {
      userId: check.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "Order",
      entityId: String(id),
      description: `وضعیت سفارش #${id} از ${before.status} به ${status} تغییر کرد`,
      oldValue: { status: before.status },
      newValue: { status },
    });

    return NextResponse.json({ order });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در به‌روزرسانی سفارش" },
      { status: 500 }
    );
  }
}