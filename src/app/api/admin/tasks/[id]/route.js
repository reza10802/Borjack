import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin } from "@/lib/auth";

export async function PATCH(req, { params }) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  const user = check.user;
  const { id } = await params;
  const { done } = await req.json();

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "تسک پیدا نشد" }, { status: 404 });
  }

  // فقط گیرنده یا فرستنده تسک بتواند done را تغییر دهد
  if (task.toId !== user.id && task.fromId !== user.id) {
    return NextResponse.json({ error: "دسترسی ندارید" }, { status: 403 });
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { done: Boolean(done) },
    include: {
      from: { select: { id: true, name: true, role: true } },
      to: { select: { id: true, name: true, role: true } },
    },
  });

  return NextResponse.json({ task: updated });
}

export async function DELETE(req, { params }) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  const user = check.user;
  const { id } = await params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return NextResponse.json({ error: "تسک پیدا نشد" }, { status: 404 });
  }

  // فقط فرستنده یا ادمین بتواند حذف کند
  if (task.fromId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "فقط فرستنده یا ادمین میتواند حذف کند" },
      { status: 403 }
    );
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ success: true });
}