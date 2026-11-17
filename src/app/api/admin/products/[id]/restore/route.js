
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";
import { isEligibleOwner } from "@/lib/supplier-lifecycle";

// POST /api/admin/products/[id]/restore
// بازیابی محصول آرشیوشده
export async function POST(_req, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id: rawId } = await params;
    const productId = Number(rawId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول معتبر نیست" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          deletedAt: true,
          isPublished: true,
          supplierId: true, // explicit opt-in: hidden by the global omit
        },
      });

      if (!product) {
        return { type: "NOT_FOUND" };
      }

      if (product.deletedAt === null) {
        return {
          type: "ALREADY_ACTIVE",
          product,
        };
      }

      // Restore never publishes anything by itself, and never re-lists a product whose
      // owner is no longer an active SUPPLIER.
      const owner = product.supplierId
        ? await tx.user.findUnique({ where: { id: product.supplierId }, select: { role: true, isActive: true } })
        : null;

      const restoredProduct = await tx.product.update({
        where: { id: productId },
        data: {
          deletedAt: null,
          ...(product.isPublished && !isEligibleOwner(owner) ? { isPublished: false } : {}),
        },
        include: {
          category: {
            select: {
              id: true,
              title: true,
            },
          },
          images: true,
          specs: true,
        },
      });

      return {
        type: "RESTORED",
        product,
        restoredProduct,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "ALREADY_ACTIVE") {
      return NextResponse.json({
        success: true,
        message: "این محصول قبلاً بازیابی شده است",
      });
    }

    await logAction({
      userId: check.user.id,
      action: "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: String(productId),
      description: `محصول «${result.product.title}» از آرشیو بازیابی شد`,
      oldValue: {
        deletedAt: result.product.deletedAt,
      },
      newValue: {
        deletedAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "محصول با موفقیت بازیابی شد",
      product: result.restoredProduct,
    });
  } catch (error) {
    console.error("RESTORE ADMIN PRODUCT ERROR:", error);

    return NextResponse.json(
      { error: "خطا در بازیابی محصول" },
      { status: 500 },
    );
  }
}
