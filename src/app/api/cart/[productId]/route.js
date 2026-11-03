
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

const MAX_QUANTITY_PER_ITEM = 20;

// PATCH /api/cart/[productId] — تغییر تعداد
export async function PATCH(req, { params }) {
  const check = await requireAuth();
  if (check.error) return check.error;

  try {
    const { productId } = await params;
    const numericProductId = Number(productId);

    if (
      !Number.isSafeInteger(numericProductId) ||
      numericProductId <= 0
    ) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const qty = Number(body?.quantity);

    if (!Number.isSafeInteger(qty) || qty < 1) {
      return NextResponse.json(
        { error: "تعداد نامعتبر است" },
        { status: 400 },
      );
    }

    if (qty > MAX_QUANTITY_PER_ITEM) {
      return NextResponse.json(
        {
          error: `حداکثر ${MAX_QUANTITY_PER_ITEM} عدد از هر کالا مجاز است`,
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // قفل محصول برای جلوگیری از خواندن موجودی قدیمی
      const lockedRows = await tx.$queryRaw`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${numericProductId}
        FOR UPDATE
      `;

      if (!lockedRows.length) {
        return { type: "PRODUCT_NOT_FOUND" };
      }

      const existing = await tx.cartItem.findUnique({
        where: {
          userId_productId: {
            userId: check.user.id,
            productId: numericProductId,
          },
        },
      });

      if (!existing) {
        return { type: "CART_ITEM_NOT_FOUND" };
      }

      const product = await tx.product.findUnique({
        where: {
          id: numericProductId,
        },
        select: {
          stock: true,
          reservedStock: true,
          isPublished: true,
          deletedAt: true,
        },
      });

      if (!product) {
        return { type: "PRODUCT_NOT_FOUND" };
      }

      // کاهش تعداد همیشه مجاز است.
      // فقط افزایش تعداد باید با موجودی آزاد کنترل شود.
      if (qty > existing.quantity) {
        if (!product.isPublished || product.deletedAt) {
          return { type: "PRODUCT_UNAVAILABLE" };
        }

        const availableStock = Math.max(
          0,
          Number(product.stock) - Number(product.reservedStock),
        );

        // تعداد نهایی را بررسی می‌کنیم، نه فقط مقدار افزایش را.
        if (qty > availableStock) {
          return {
            type: "INSUFFICIENT_STOCK",
            availableStock,
          };
        }
      }

      const updated = await tx.cartItem.update({
        where: {
          userId_productId: {
            userId: check.user.id,
            productId: numericProductId,
          },
        },
        data: {
          quantity: qty,
        },
        include: {
          product: {
            include: {
              images: true,
            },
          },
        },
      });

      const {
        reservedStock,
        ...publicProduct
      } = updated.product;

      const availableStock =
        publicProduct.isPublished &&
        !publicProduct.deletedAt
          ? Math.max(
              0,
              Number(publicProduct.stock) - Number(reservedStock),
            )
          : 0;

      return {
        type: "SUCCESS",
        data: {
          ...updated,
          product: {
            ...publicProduct,
            availableStock,
          },
        },
      };
    });

    if (result.type === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "CART_ITEM_NOT_FOUND") {
      return NextResponse.json(
        { error: "آیتمی در سبد خرید پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "PRODUCT_UNAVAILABLE") {
      return NextResponse.json(
        { error: "این محصول دیگر قابل خرید نیست" },
        { status: 409 },
      );
    }

    if (result.type === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          error: `فقط ${result.availableStock} عدد از این محصول قابل خرید است`,
          availableStock: result.availableStock,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("PATCH /api/cart/[productId] ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در به‌روزرسانی سبد خرید" },
      { status: 500 },
    );
  }
}

// DELETE /api/cart/[productId] — حذف آیتم
export async function DELETE(_req, { params }) {
  const check = await requireAuth();
  if (check.error) return check.error;

  try {
    const { productId } = await params;
    const numericProductId = Number(productId);

    if (
      !Number.isSafeInteger(numericProductId) ||
      numericProductId <= 0
    ) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
      );
    }

    const result = await prisma.cartItem.deleteMany({
      where: {
        userId: check.user.id,
        productId: numericProductId,
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: "آیتمی در سبد خرید پیدا نشد" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "آیتم حذف شد",
    });
  } catch (error) {
    console.error("DELETE /api/cart/[productId] ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در حذف آیتم" },
      { status: 500 },
    );
  }
}
