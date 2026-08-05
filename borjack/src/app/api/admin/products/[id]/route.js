import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, requireAdmin, logAction } from "@/lib/auth";

const ADMIN_ALLOWED_FIELDS = [
  "title",
  "price",
  "originalPrice",
  "discount",
  "categoryId",
  "image",
  "description",
  "stock",
];

const MANAGER_ALLOWED_FIELDS = ["price", "originalPrice", "discount", "stock"];

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
      auth.user.role === "ADMIN"
        ? ADMIN_ALLOWED_FIELDS
        : MANAGER_ALLOWED_FIELDS;
    console.log(body);
    console.log("PATCH BODY =>", JSON.stringify(body, null, 2));
    console.log(Object.keys(body));
    const data = {};

    for (const field of allowedFields) {
      // فقط فیلدهایی که واقعاً ارسال شدن
      if (body[field] === undefined) continue;

      if (field === "categoryId") {
        data.category = {
          connect: {
            id: Number(body.categoryId),
          },
        };
      } else if (
        field === "price" ||
        field === "originalPrice" ||
        field === "discount" ||
        field === "stock"
      ) {
        data[field] = Number(body[field]);
      } else if (field === "stock") {
        data.stock = Number(body.stock);
      } else {
        data[field] = body[field];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "فیلد مجاز برای ویرایش ارسال نشده" },
        { status: 400 },
      );
    }

    await prisma.product.update({
      where: { id: productId },
      data,
    });

    // بروزرسانی گالری تصاویر
    if (Array.isArray(body.gallery)) {
      await prisma.productImage.deleteMany({
        where: {
          productId,
        },
      });

      if (body.gallery.length > 0) {
        await prisma.productImage.createMany({
          data: body.gallery.filter(Boolean).map((url) => ({
            productId,
            url,
          })),
        });
      }
    }

    // محصول نهایی را همراه روابط برگردان
    const product = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      include: {
        category: true,
        images: true,
        specs: true,
      },
    });

    const isStockOnly = Object.keys(data).length === 1 && "stock" in data;

    await logAction({
      userId: auth.user.id,
      action: isStockOnly ? "UPDATE_STOCK" : "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: productId,
      description: `ویرایش محصول "${before.title}"`,
      oldValue: before,
      newValue: {
        ...data,
        gallery: body.gallery,
      },
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
        { status: 409 },
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
