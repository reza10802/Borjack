
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const MAX_QUANTITY_PER_ITEM = 20;

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نشدی" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];

    // اعتبارسنجی و تجمیع شناسه‌های تکراری
    const quantities = new Map();

    for (const raw of items) {
      if (!raw || typeof raw !== "object") {
        continue;
      }

      const productId = Number(raw.productId);
      const quantity = Number(raw.quantity);

      if (
        !Number.isSafeInteger(productId) ||
        productId <= 0 ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        continue;
      }

      const previous = quantities.get(productId) || 0;

      quantities.set(
        productId,
        Math.min(
          previous + Math.min(quantity, MAX_QUANTITY_PER_ITEM),
          MAX_QUANTITY_PER_ITEM,
        ),
      );
    }

    // ترتیب ثابت برای کاهش احتمال Deadlock
    const entries = [...quantities.entries()].sort(
      ([a], [b]) => a - b,
    );

    const result = await prisma.$transaction(async (tx) => {
      // پاک‌سازی محصولات آرشیوشده از سبد قبلی
      await tx.cartItem.deleteMany({
        where: {
          userId: user.id,
          product: {
            is: {
              deletedAt: {
                not: null,
              },
            },
          },
        },
      });

      const adjustedItems = [];
      const skippedItems = [];

      for (const [productId, guestQuantity] of entries) {
        // قفل ردیف محصول برای خواندن موجودی به‌روز
        const lockedRows = await tx.$queryRaw`
          SELECT
            "id",
            "stock",
            "reservedStock",
            "isPublished",
            "deletedAt"
          FROM "Product"
          WHERE "id" = ${productId}
          FOR UPDATE
        `;

        const product = lockedRows[0];

        if (!product || product.deletedAt || !product.isPublished) {
          skippedItems.push({
            productId,
            reason: "UNAVAILABLE",
          });
          continue;
        }

        const availableStock = Math.max(
          0,
          Number(product.stock) - Number(product.reservedStock),
        );

        if (availableStock <= 0) {
          skippedItems.push({
            productId,
            reason: "OUT_OF_STOCK",
            availableStock: 0,
          });
          continue;
        }

        const existing = await tx.cartItem.findUnique({
          where: {
            userId_productId: {
              userId: user.id,
              productId,
            },
          },
        });

        const existingQuantity = existing?.quantity || 0;

        const rawRequestedQuantity =
          existingQuantity + guestQuantity;

        const requestedQuantity = Math.min(
          rawRequestedQuantity,
          MAX_QUANTITY_PER_ITEM,
        );

        // سقف تعداد هر کالا را به کاربر اطلاع می‌دهیم.
        if (rawRequestedQuantity > MAX_QUANTITY_PER_ITEM) {
          adjustedItems.push({
            productId,
            requestedQuantity: rawRequestedQuantity,
            acceptedQuantity: MAX_QUANTITY_PER_ITEM,
            reason: "MAX_QUANTITY",
          });
        }

        // اگر موجودی کافی نیست، تعداد قبلی سبد را دست نمی‌زنیم.
        // مشتری خودش باید تعداد را اصلاح کند.
        if (requestedQuantity > availableStock) {
          skippedItems.push({
            productId,
            reason: "INSUFFICIENT_STOCK",
            requestedQuantity,
            existingQuantity,
            availableStock,
          });
          continue;
        }

        if (existing) {
          await tx.cartItem.update({
            where: {
              userId_productId: {
                userId: user.id,
                productId,
              },
            },
            data: {
              quantity: requestedQuantity,
            },
          });
        } else {
          await tx.cartItem.create({
            data: {
              userId: user.id,
              productId,
              quantity: requestedQuantity,
            },
          });
        }
      }

      return {
        adjustedItems,
        skippedItems,
      };
    });

    return NextResponse.json({
      success: true,
      adjustedItems: result.adjustedItems,
      skippedItems: result.skippedItems,
    });
  } catch (error) {
    console.error("CART MERGE ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در ادغام سبد خرید" },
      { status: 500 },
    );
  }
}
