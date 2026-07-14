import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, requireAdmin, logAction } from "@/lib/auth";

const ADMIN_ALLOWED_FIELDS = [
  "title",
  "price",
  "originalPrice",
  "discount",
  "category",
  "image",
  "description",
  "inStock",
];

const MANAGER_ALLOWED_FIELDS = [
  "price",
  "originalPrice",
  "discount",
  "inStock",
];

export async function PATCH(req, { params }) {
  const auth = await requireManagerOrAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const productId = Number(id);
    const body = await req.json();

    const before = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!before) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    const allowedFields =
      auth.user.role === "ADMIN" ? ADMIN_ALLOWED_FIELDS : MANAGER_ALLOWED_FIELDS;

    const data = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field];
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "فیلد مجاز برای ویرایش ارسال نشده" },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data,
    });

    const isStockOnly = Object.keys(data).length === 1 && "inStock" in data;

    await logAction({
      userId: auth.user.id,
      action: isStockOnly ? "UPDATE_STOCK" : "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: productId,
      description: `ویرایش محصول "${before.title}"`,
      oldValue: before,
      newValue: data,
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در ویرایش محصول" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const productId = Number(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
    }

    const orderItemCount = await prisma.orderItem.count({
      where: { productId },
    });

    if (orderItemCount > 0) {
      return NextResponse.json(
        {
          error:
            "این محصول در سفارشات قبلی استفاده شده و قابل حذف نیست. به‌جای حذف، موجودی آن را ناموجود کن.",
        },
        { status: 409 }
      );
    }

    await prisma.review.deleteMany({ where: { productId } });
    await prisma.productSpec.deleteMany({ where: { productId } });
    await prisma.productImage.deleteMany({ where: { productId } });
    await prisma.cartItem.deleteMany({ where: { productId } });

    await prisma.product.delete({ where: { id: productId } });

    await logAction({
      userId: auth.user.id,
      action: "DELETE_PRODUCT",
      entityType: "Product",
      entityId: productId,
      description: `حذف محصول "${product.title}"`,
      oldValue: product,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در حذف محصول" }, { status: 500 });
  }
}