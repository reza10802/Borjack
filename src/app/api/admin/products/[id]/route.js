
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, requireAdmin, logAction } from "@/lib/auth";

// GET /api/admin/products — دریافت فهرست محصولات
export async function GET(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
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

    return NextResponse.json({ products });
  } catch (error) {
    console.error("GET ADMIN PRODUCTS ERROR:", error);

    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}

// POST /api/admin/products — ساخت محصول جدید
export async function POST(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const body = await req.json();

    const {
      title,
      price,
      originalPrice,
      discount,
      categoryId,
      image,
      gallery = [],
      description,
      stock,
      specs = [],
    } = body;

    // اعتبارسنجی اطلاعات ضروری
    if (
      typeof title !== "string" ||
      !title.trim() ||
      price == null ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      !categoryId ||
      !Number.isFinite(Number(categoryId)) ||
      typeof image !== "string" ||
      !image.trim() ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return NextResponse.json(
        { error: "اطلاعات ضروری محصول را به‌درستی وارد کنید" },
        { status: 400 },
      );
    }

    // اعتبارسنجی قیمت اصلی
    const finalPrice = Number(price);

    const finalOriginalPrice =
      originalPrice != null && originalPrice !== ""
        ? Number(originalPrice)
        : finalPrice;

    if (
      !Number.isFinite(finalOriginalPrice) ||
      finalOriginalPrice < finalPrice
    ) {
      return NextResponse.json(
        { error: "قیمت اصلی نمی‌تواند کمتر از قیمت فروش باشد" },
        { status: 400 },
      );
    }

    // آماده‌سازی گالری تصاویر
    if (
      !Array.isArray(gallery) ||
      gallery.some(
        (url) => typeof url !== "string" || !url.trim(),
      )
    ) {
      return NextResponse.json(
        { error: "فهرست تصاویر معتبر نیست" },
        { status: 400 },
      );
    }

    // آماده‌سازی مشخصات فنی
    if (!Array.isArray(specs)) {
      return NextResponse.json(
        { error: "فهرست مشخصات فنی معتبر نیست" },
        { status: 400 },
      );
    }

    const normalizedSpecs = specs
      .filter(
        (spec) =>
          spec &&
          typeof spec.key === "string" &&
          typeof spec.value === "string" &&
          spec.key.trim() &&
          spec.value.trim(),
      )
      .map((spec) => ({
        key: spec.key.trim(),
        value: spec.value.trim(),
      }));

    // ساخت محصول، تصاویر و مشخصات فنی در یک عملیات
    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        price: finalPrice,
        originalPrice: finalOriginalPrice,
        discount: Number(discount) || 0,

        category: {
          connect: {
            id: Number(categoryId),
          },
        },

        image: image.trim(),
        description: description.trim(),
        stock: Number(stock ?? 0),

        images: {
          create: gallery.map((url) => ({
            url: url.trim(),
          })),
        },

        specs: {
          create: normalizedSpecs,
        },
      },

      include: {
        category: true,
        images: true,
        specs: true,
      },
    });

    // ثبت گزارش فعالیت
    await logAction(req, {
      userId: check.user.id,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: String(product.id),
      description: `محصول «${product.title}» ایجاد شد`,
      newValue: product,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("CREATE ADMIN PRODUCT ERROR:", error);

    return NextResponse.json(
      { error: "خطا در ساخت محصول" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/products/[id] — حذف محصول
export async function DELETE(_req, { params }) {
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
          slug: true,
          price: true,
          stock: true,
          isPublished: true,
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      if (!product) {
        return { type: "NOT_FOUND" };
      }

      if (product._count.orderItems > 0) {
        return {
          type: "HAS_ORDERS",
          count: product._count.orderItems,
        };
      }

      await tx.product.delete({
        where: { id: productId },
      });

      return {
        type: "DELETED",
        product,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "HAS_ORDERS") {
      return NextResponse.json(
        {
          error:
            "این محصول در سفارش‌های ثبت‌شده وجود دارد و برای حفظ سوابق خرید قابل حذف نیست.",
        },
        { status: 409 },
      );
    }

    await logAction({
      userId: check.user.id,
      action: "DELETE_PRODUCT",
      entityType: "Product",
      entityId: String(productId),
      description: `محصول «${result.product.title}» حذف شد`,
      oldValue: {
        id: result.product.id,
        title: result.product.title,
        slug: result.product.slug,
        price: result.product.price,
        stock: result.product.stock,
        isPublished: result.product.isPublished,
      },
    });

    return NextResponse.json({
      success: true,
      message: "محصول با موفقیت حذف شد",
    });
  } catch (error) {
    if (error?.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "این محصول به اطلاعات دیگری وابسته است و امکان حذف آن وجود ندارد.",
        },
        { status: 409 },
      );
    }

    console.error("DELETE ADMIN PRODUCT ERROR:", error);

    return NextResponse.json(
      { error: "خطا در حذف محصول" },
      { status: 500 },
    );
  }
}