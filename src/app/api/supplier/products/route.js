
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSupplier, logAction } from "@/lib/auth";
import { PRODUCT_LIST_SELECT } from "@/lib/supplier-products";

const STATUS_FILTERS = {
  all: {},
  published: { isPublished: true, deletedAt: null },
  unpublished: { isPublished: false, deletedAt: null },
  archived: { deletedAt: { not: null } },
};

const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// GET: دریافت محصولات تأمین‌کننده جاری
export async function GET(req) {
  const auth = await requireSupplier();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const page = toInt(searchParams.get("page"), 1, 1, 100000);
    const limit = toInt(searchParams.get("limit"), 12, 1, 50);

    const requestedStatus = searchParams.get("status");
    const status = Object.hasOwn(
      STATUS_FILTERS,
      requestedStatus ?? "",
    )
      ? requestedStatus
      : "all";

    const mine = { supplierId: auth.user.id };
    const where = { ...mine, ...STATUS_FILTERS[status] };

    const [
      items,
      total,
      all,
      published,
      unpublished,
      archived,
      outOfStock,
    ] = await Promise.all([
      prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
      prisma.product.count({ where: mine }),
      prisma.product.count({
        where: { ...mine, ...STATUS_FILTERS.published },
      }),
      prisma.product.count({
        where: { ...mine, ...STATUS_FILTERS.unpublished },
      }),
      prisma.product.count({
        where: { ...mine, ...STATUS_FILTERS.archived },
      }),
      prisma.product.count({
        where: {
          ...mine,
          ...STATUS_FILTERS.published,
          stock: 0,
        },
      }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      counts: {
        all,
        published,
        unpublished,
        archived,
        outOfStock,
      },
    });
  } catch (error) {
    console.error("SUPPLIER_PRODUCTS_ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}

// POST: ایجاد محصول جدید برای تأمین‌کننده جاری
export async function POST(req) {
  const auth = await requireSupplier();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "اطلاعات ارسالی معتبر نیست" },
        { status: 400 },
      );
    }

    // مالکیت و وضعیت تأیید فقط توسط سرور تعیین می‌شوند.
    const forbiddenFields = [
      "supplierId",
      "isPublished",
      "reviewStatus",
      "reviewNote",
      "deletedAt",
      "reservedStock",
      "slug",
    ];

    if (forbiddenFields.some((field) => Object.hasOwn(body, field))) {
      return NextResponse.json(
        { error: "ارسال فیلدهای مدیریتی یا مالکیت محصول مجاز نیست" },
        { status: 400 },
      );
    }

    const {
      title,
      price,
      originalPrice,
      discount,
      categoryId,
      image,
      gallery,
      description,
      stock,
      specs,
    } = body;

    const finalPrice = Number(price);
    const finalOriginalPrice =
      originalPrice == null || originalPrice === ""
        ? finalPrice
        : Number(originalPrice);

    const finalDiscount = Number(discount ?? 0);
    const finalCategoryId = Number(categoryId);
    const finalStock = Number(stock ?? 0);

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof image !== "string" ||
      !image.trim() ||
      !Number.isSafeInteger(finalPrice) ||
      finalPrice <= 0 ||
      !Number.isSafeInteger(finalOriginalPrice) ||
      finalOriginalPrice < finalPrice ||
      !Number.isSafeInteger(finalDiscount) ||
      finalDiscount < 0 ||
      finalDiscount > 100 ||
      !Number.isSafeInteger(finalCategoryId) ||
      finalCategoryId <= 0 ||
      !Number.isSafeInteger(finalStock) ||
      finalStock < 0
    ) {
      return NextResponse.json(
        { error: "اطلاعات ضروری محصول را به‌درستی وارد کنید" },
        { status: 400 },
      );
    }

    // تصویر اصلی جدا از حداکثر ۴ تصویر گالری است.
    if (
      !Array.isArray(gallery) ||
      gallery.length > 4 ||
      gallery.some(
        (url) => typeof url !== "string" || !url.trim(),
      )
    ) {
      return NextResponse.json(
        { error: "حداکثر ۴ تصویر گالری مجاز است" },
        { status: 400 },
      );
    }

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
          spec.key.trim() &&
          spec.value != null &&
          String(spec.value).trim(),
      )
      .map((spec) => ({
        key: spec.key.trim(),
        value: String(spec.value).trim(),
      }));

    const baseSlug = slugify(title);

    if (!baseSlug) {
      return NextResponse.json(
        { error: "عنوان محصول برای ساخت آدرس معتبر نیست" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id: finalCategoryId },
        select: { id: true },
      });

      if (!category) {
        return { type: "CATEGORY_NOT_FOUND" };
      }

      let slug = baseSlug;
      let suffix = 1;

      while (
        await tx.product.findUnique({
          where: { slug },
          select: { id: true },
        })
      ) {
        slug = `${baseSlug}-${suffix++}`;
      }

      const product = await tx.product.create({
        data: {
          title: title.trim(),
          slug,
          price: finalPrice,
          originalPrice: finalOriginalPrice,
          discount: finalDiscount,
          categoryId: finalCategoryId,
          image: image.trim(),
          description: description.trim(),
          stock: finalStock,

          // مالکیت از نشست معتبر گرفته می‌شود.
          supplierId: auth.user.id,

          // محصول تأمین‌کننده بدون تأیید ادمین منتشر نمی‌شود.
          isPublished: false,
          reviewStatus: "PENDING",
          reviewNote: null,

          images: {
            create: gallery.map((url) => ({
              url: url.trim(),
            })),
          },

          specs: {
            create: normalizedSpecs,
          },
        },
        select: {
          ...PRODUCT_LIST_SELECT,
          categoryId: true,
          description: true,
          images: true,
          specs: true,
        },
      });

      return {
        type: "CREATED",
        product,
      };
    });

    if (result.type === "CATEGORY_NOT_FOUND") {
      return NextResponse.json(
        { error: "دسته‌بندی انتخاب‌شده پیدا نشد" },
        { status: 404 },
      );
    }

    await logAction({
      userId: auth.user.id,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: String(result.product.id),
      description: `تأمین‌کننده محصول «${result.product.title}» را برای بررسی ثبت کرد`,
      newValue: {
        title: result.product.title,
        price: result.product.price,
        stock: result.product.stock,
        reviewStatus: result.product.reviewStatus,
      },
    });

    return NextResponse.json(
      {
        success: true,
        product: result.product,
        message: "محصول برای بررسی و تأیید مدیر ثبت شد.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE SUPPLIER PRODUCT ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "محصولی با همین آدرس قبلاً ثبت شده است؛ دوباره تلاش کنید." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ثبت محصول" },
      { status: 500 },
    );
  }
}
