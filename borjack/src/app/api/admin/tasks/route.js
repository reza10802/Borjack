import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrManager } from "@/lib/auth";

// GET /api/admin/tasks — گرفتن تسک‌های من
export async function GET(req) {
    const { session, error } = await requireAdminOrManager();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "received"; // received | sent | all

    let where = {};
    if (filter === "received") where = { toId: session.id };
    else if (filter === "sent") where = { fromId: session.id };
    else where = { OR: [{ toId: session.id }, { fromId: session.id }] };

    const tasks = await prisma.task.findMany({
        where,
        include: {
            from: { select: { id: true, name: true, role: true } },
            to: { select: { id: true, name: true, role: true } },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
}

// POST /api/admin/tasks — ساخت تسک جدید
export async function POST(req) {
    const { session, error } = await requireAdminOrManager();
    if (error) return error;

    const { title, description, priority, toId } = await req.json();

    if (!title || !toId) {
        return NextResponse.json({ error: "عنوان و گیرنده الزامی است" }, { status: 400 });
    }

    const to = await prisma.user.findUnique({ where: { id: toId } });
    if (!to) return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });

    const task = await prisma.task.create({
        data: {
            title,
            description,
            priority: priority || "MEDIUM",
            fromId: session.id,
            toId,
        },
        include: {
            from: { select: { id: true, name: true, role: true } },
            to: { select: { id: true, name: true, role: true } },
        },
    });

    return NextResponse.json({ task }, { status: 201 });
}