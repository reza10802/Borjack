import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin } from "@/lib/auth";

// GET /api/admin/tasks — گرفتن تسک‌های من
export async function GET(req) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  const user = check.user;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "received"; // received | sent | all

    let where = {};

    if (filter === "received") {
      where = { toId: user.id };
    } else if (filter === "sent") {
      where = { fromId: user.id };
    } else {
      where = {
        OR: [{ toId: user.id }, { fromId: user.id }],
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        from: { select: { id: true, name: true, role: true } },
        to: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("GET /api/admin/tasks error:", error);
    return NextResponse.json(
      { error: "خطا در دریافت تسک‌ها" },
      { status: 500 },
    );
  }
}

// POST /api/admin/tasks — ساخت تسک جدید
export async function POST(req) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  const user = check.user;

  try {
    const { title, description, priority, toId } = await req.json();

    if (!title || !toId) {
      return NextResponse.json(
        { error: "عنوان و گیرنده الزامی است" },
        { status: 400 },
      );
    }
    console.log({
      title,
      description,
      priority,
      toId,
    });
    const to = await prisma.user.findUnique({
      where: { id: toId },
      select: { id: true, name: true, role: true },
    });

    if (!to) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || null,
        priority: priority || "MEDIUM",
        fromId: user.id,
        toId: toId,
      },
      include: {
        from: { select: { id: true, name: true, role: true } },
        to: { select: { id: true, name: true, role: true } },
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/tasks error:", error);
    return NextResponse.json({ error: "خطا در ساخت تسک" }, { status: 500 });
  }
}
