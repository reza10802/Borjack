import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "../../../../../lib/auth";

const VALID_STATUSES = [
    "PENDING",
    "PROCESSING",
    "READY_TO_SHIP",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
];

// PATCH /api/admin/orders/[id] — تغییر وضعیت سفارش (ADMIN یا MANAGER)
export async function PATCH(req, { params }) {
    const check = await requireManagerOrAdmin(req);
    if (check.error) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    try {
        const { id } = await params;
        const { status } = await req.json();

        if (!VALID_STATUSES.includes(status)) {
            return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
        }

        const before = await prisma.order.findUnique({ where: { id: Number(id) } });

        const order = await prisma.order.update({
            where: { id: Number(id) },
            data: { status },
            include: {
                user: { select: { id: true, name: true, identifier: true } },
                items: { include: { product: { include: { images: true } } } },
            },
        });

        await logAction(req, {
            userId: check.user.id,
            action: "UPDATE_ORDER_STATUS",
            entityType: "Order",
            entityId: id,
            description: `وضعیت سفارش #${id} تغییر کرد`,
            oldValue: { status: before?.status },
            newValue: { status },
        });

        return NextResponse.json(order);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در به‌روزرسانی سفارش" }, { status: 500 });
    }
}