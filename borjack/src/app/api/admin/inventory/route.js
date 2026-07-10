import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";

// GET /api/admin/inventory — لیست کالاها برای انبار
export async function GET(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        title: true,
        category: true,
        inStock: true,
        price: true,
        image: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت موجودی" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/inventory — تغییر وضعیت موجودی
export async function PATCH(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const body = await req.json();
    const { productId, inStock } = body;

    if (typeof productId !== "number" || typeof inStock !== "boolean") {
      return NextResponse.json(
        { error: "اطلاعات ارسالی نامعتبر است" },
        { status: 400 }
      );
    }

    const before = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, title: true, inStock: true },
    });

    if (!before) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { inStock },
      select: {
        id: true,
        title: true,
        category: true,
        inStock: true,
        price: true,
        image: true,
      },
    });

    await logAction(req, {
      userId: check.user.id,
      action: "UPDATE_STOCK",
      entityType: "Product",
      entityId: String(productId),
      description: `موجودی محصول «${before.title}» از ${before.inStock} به ${inStock} تغییر کرد`,
      oldValue: { inStock: before.inStock },
      newValue: { inStock },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در به‌روزرسانی موجودی" },
      { status: 500 }
    );
  }
}