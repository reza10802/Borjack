import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";

const ALLOWED_ROLES = ["CUSTOMER", "MANAGER"];

export async function PATCH(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { role, isActive } = await req.json();

    if (role && !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید نقش خودتان را تغییر دهید" },
        { status: 400 },
      );
    }

    const before = await prisma.user.findUnique({ where: { id } });

    if (!before) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (before.role === "ADMIN") {
      return NextResponse.json(
        { error: "نقش ادمین از این بخش قابل تغییر نیست" },
        { status: 403 },
      );
    }

    const updateData = {};

    if (role) {
      updateData.role = role;
    }

    if (typeof isActive === "boolean") {
      updateData.isActive = isActive;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        _count: { select: { orders: true } },
        isActive: true,
      },
    });

    await logAction({
      userId: auth.user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      description: `تغییر نقش "${before.name}" از ${before.role} به ${role}`,
      oldValue: { role: before.role },
      newValue: { role },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در تغییر نقش کاربر" },
      { status: 500 },
    );
  }
}
export async function PUT(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "نمی‌توانید حساب خودتان را مسدود کنید." },
        { status: 400 },
      );
    }

    const before = await prisma.user.findUnique({
      where: { id },
    });

    if (!before) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (before.role === "ADMIN") {
      return NextResponse.json(
        { error: "ادمین قابل مسدود شدن نیست." },
        { status: 403 },
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        isActive,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
    });

    await logAction({
      userId: auth.user.id,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      description: isActive
        ? `کاربر ${before.name} فعال شد`
        : `کاربر ${before.name} مسدود شد`,
      oldValue: { isActive: before.isActive },
      newValue: { isActive },
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "خطا در تغییر وضعیت کاربر" },
      { status: 500 },
    );
  }
}
