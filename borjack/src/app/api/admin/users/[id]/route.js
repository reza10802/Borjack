import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";

const ALLOWED_ROLES = ["CUSTOMER", "MANAGER"];

export async function PATCH(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { role } = await req.json();

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "ارتقا به ADMIN از پنل مجاز نیست" },
        { status: 400 }
      );
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید نقش خودتان را تغییر دهید" },
        { status: 400 }
      );
    }

    const before = await prisma.user.findUnique({ where: { id } });

    if (!before) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (before.role === "ADMIN") {
      return NextResponse.json(
        { error: "نقش ادمین از این بخش قابل تغییر نیست" },
        { status: 403 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        identifier: true,
        role: true,
        _count: { select: { orders: true } },
      },
    });

    await logAction({
      userId: auth.user.id,
      action: "UPDATE_USER_ROLE",
      entityType: "User",
      entityId: id,
      description: `تغییر نقش "${before.name}" از ${before.role} به ${role}`,
      oldValue: { role: before.role },
      newValue: { role },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در تغییر نقش کاربر" }, { status: 500 });
  }
}