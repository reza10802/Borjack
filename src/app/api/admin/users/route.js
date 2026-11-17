import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";

export async function GET(req) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  let where = {};

  if (role === "staff") {
    where.role = {
      in: ["ADMIN"],
    };
  } else if (role === "supplier") {
    where.role = "SUPPLIER";
  } else if (role === "customer") {
    where.role = "CUSTOMER";
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
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
        { status: 400 },
      );
    }

    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) {
      return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
    }

    if (before.role === "ADMIN") {
      return NextResponse.json(
        { error: "حذف ادمین از پنل مجاز نیست" },
        { status: 403 },
      );
    }

    // Never delete a user who owns products or has orders: Postgres would refuse (and the
    // history would be lost if it did not). Blocking / demoting is the supported way to retire them.
    const [productCount, orderCount] = await Promise.all([
      prisma.product.count({ where: { supplierId: userId } }),
      prisma.order.count({ where: { userId } }),
    ]);

    if (productCount > 0 || orderCount > 0) {
      return NextResponse.json(
        {
          error: "این کاربر دارای محصول یا سفارش است و حذف نمی‌شود. به‌جای حذف، حساب را مسدود کنید یا نقش را تغییر دهید.",
          productCount,
          orderCount,
        },
        { status: 409 },
      );
    }

    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (e) {
      if (e?.code === "P2003") {
        return NextResponse.json({ error: "به دلیل وابستگی‌های ثبت‌شده، حذف این کاربر ممکن نیست؛ حساب را مسدود کنید." }, { status: 409 });
      }
      throw e;
    }

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
