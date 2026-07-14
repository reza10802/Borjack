import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function DELETE(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId الزامی است" }, { status: 400 });
    }

    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید حساب خودتان را حذف کنید" },
        { status: 400 }
      );
    }

    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (before.role === "ADMIN") {
      return NextResponse.json(
        { error: "حذف ادمین از پنل مجاز نیست" },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    await logAction({
      userId: auth.user.id,
      action: "DELETE_USER",
      entityType: "User",
      entityId: userId,
      description: `حذف کاربر "${before.name}"`,
      oldValue: before,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در حذف کاربر" }, { status: 500 });
  }
}