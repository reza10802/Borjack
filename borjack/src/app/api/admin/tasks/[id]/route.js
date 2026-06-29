import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminOrManager } from "@/lib/auth";

export async function PATCH(req, { params }) {
    const { session, error } = await requireAdminOrManager();
    if (error) return error;

    const { id } = await params;
    const { done } = await req.json();

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "تسک پیدا نشد" }, { status: 404 });

    if (task.toId !== session.id && task.fromId !== session.id) {
        return NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 });
    }

    const updated = await prisma.task.update({
        where: { id },
        data: { done },
        include: {
            from: { select: { id: true, name: true, role: true } },
            to: { select: { id: true, name: true, role: true } },
        },
    });

    return NextResponse.json({ task: updated });
}

export async function DELETE(req, { params }) {
    const { session, error } = await requireAdminOrManager();
    if (error) return error;

    const { id } = await params;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: "تسک پیدا نشد" }, { status: 404 });

    if (task.fromId !== session.id && session.role !== "ADMIN") {
        return NextResponse.json({ error: "فقط فرستنده یا ادمین میتواند حذف کند" }, { status: 403 });
    }

    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
}