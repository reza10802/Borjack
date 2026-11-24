
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  logAction,
} from "@/lib/auth";
import {
  calculateProductPricing,
  PricingError,
} from "@/lib/pricing";

// ساخت slug از عنوان فارسی یا انگلیسی
function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// تولید slug یکتا
async function generateUniqueSlug(title) {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    throw new Error("INVALID_PRODUCT_SLUG");
  }

  let slug = baseSlug;
  let suffix = 1;

  while (
    await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return slug;
}

// GET /api/admin/products
// دریافت محصولات فعال یا آرشیوشده همراه با اطلاعات تأمین‌کننده و وضعیت بررسی
export async function GET(req) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);

    const archived =
      searchParams.get("archived") === "true";

    const reviewStatus =
      searchParams.get("reviewStatus");

    const allowedStatuses = [
      "PENDING",
      "APPROVED",
      "REJECTED",
    ];

    if (
      reviewStatus &&
      !allowedStatuses.includes(reviewStatus)
    ) {
      return NextResponse.json(
        { error: "وضعیت بررسی محصول معتبر نیست" },
        { status: 400 },
      );
    }

    const where = {
      deletedAt: archived ? { not: null } : null,
      ...(reviewStatus ? { reviewStatus } : {}),
    };

    const products = await prisma.product.findMany({
      where,
      orderBy: {
        createdAt: "desc",
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
        supplier: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("GET ADMIN PRODUCTS ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}

// POST /api/admin/products
// ایجاد محصول برای برجک یا یک تأمین‌کننده مشخص
export async function POST(req) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const body = await req.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "اطلاعات ارسالی معتبر نیست" },
        { status: 400 },
      );
    }

    const {
      title,
      basePrice,
      discount,
      categoryId,
      image,
      gallery = [],
      description,
      stock = 0,
      specs = [],
    } = body;

    // مالکیت محصول فقط توسط ADMIN تعیین می‌شود.
    // مقدار null یا ارسال‌نشدن supplierId یعنی مالکیت برجک.
    let supplierId = null;
    let supplier = null;

    if (
      Object.hasOwn(body, "supplierId") &&
      body.supplierId !== null
    ) {
      if (
        typeof body.supplierId !== "string" ||
        !body.supplierId.trim() ||
        body.supplierId.length > 128
      ) {
        return NextResponse.json(
          { error: "شناسه تأمین‌کننده معتبر نیست" },
          { status: 400 },
        );
      }

      supplierId = body.supplierId.trim();

      supplier = await prisma.user.findFirst({
        where: {
          id: supplierId,
          role: "SUPPLIER",
        },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      if (!supplier) {
        return NextResponse.json(
          { error: "تأمین‌کننده موردنظر پیدا نشد" },
          { status: 404 },
        );
      }
    }

    // اعتبارسنجی اطلاعات پایه محصول
    const finalBasePrice = Number(basePrice);
    const finalDiscount = Number(discount ?? 0);
    const finalCategoryId = Number(categoryId);
    const finalStock = Number(stock);

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 200 ||
      typeof description !== "string" ||
      !description.trim() ||
      typeof image !== "string" ||
      !image.trim() ||
      !Number.isSafeInteger(finalBasePrice) ||
      finalBasePrice <= 0 ||
      !Number.isSafeInteger(finalDiscount) ||
      finalDiscount < 0 ||
      finalDiscount > 99 ||
      !Number.isSafeInteger(finalCategoryId) ||
      finalCategoryId <= 0 ||
      !Number.isSafeInteger(finalStock) ||
      finalStock < 0
    ) {
      return NextResponse.json(
        {
          error: "اطلاعات ضروری محصول را به‌درستی وارد کنید",
        },
        { status: 400 },
      );
    }

    // محاسبه قیمت مشتری فقط در سرور
    let pricing;

    try {
      pricing = calculateProductPricing({
        basePrice: finalBasePrice,
        discount: finalDiscount,
      });
    } catch (error) {
      if (error instanceof PricingError) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 },
        );
      }

      throw error;
    }

    // تصویر اصلی جداست؛ حداکثر ۴ تصویر اضافی در گالری
    if (
      !Array.isArray(gallery) ||
      gallery.length > 4 ||
      gallery.some(
        (url) =>
          typeof url !== "string" || !url.trim(),
      )
    ) {
      return NextResponse.json(
        {
          error:
            "حداکثر ۴ عکس گالری مجاز است؛ عکس اصلی جداگانه انتخاب می‌شود.",
        },
        { status: 400 },
      );
    }

    // اعتبارسنجی مشخصات فنی
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

    const slug = await generateUniqueSlug(title);

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        slug,

        // قیمت‌ها و کمیسیون محاسبه‌شده توسط سرور
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        discount: pricing.discount,
        basePrice: pricing.basePrice,
        commissionPercent: pricing.commissionPercent,

        categoryId: finalCategoryId,
        image: image.trim(),
        description: description.trim(),
        stock: finalStock,

        // مالکیت تأییدشده توسط ADMIN
        supplierId,

        // محصولات ایجادشده توسط ADMIN تأییدشده هستند.
        reviewStatus: "APPROVED",
        reviewNote: null,

        // تأمین‌کننده غیرفعال نمی‌تواند محصول منتشرشده داشته باشد.
        isPublished: supplier
          ? supplier.isActive
          : true,

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
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        images: true,
        specs: true,
        supplier: {
          select: {
            id: true,
            name: true,
            isActive: true,
          },
        },
      },
    });

    // ثبت جزئیات مالی محصول در لاگ مدیریتی
    await logAction({
      userId: check.user.id,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: String(product.id),
      description: supplier
        ? `محصول «${product.title}» برای تأمین‌کننده «${supplier.name}» ایجاد شد`
        : `محصول «${product.title}» برای برجک ایجاد شد`,
      newValue: {
        title: product.title,
        basePrice: product.basePrice,
        commissionPercent: product.commissionPercent,
        originalPrice: product.originalPrice,
        price: product.price,
        discount: product.discount,
        stock: product.stock,
        supplierId: product.supplierId,
        supplierName: supplier?.name ?? null,
        reviewStatus: product.reviewStatus,
        isPublished: product.isPublished,
      },
    });

    return NextResponse.json(
      {
        success: true,
        product,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE ADMIN PRODUCT ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error?.message === "INVALID_PRODUCT_SLUG") {
      return NextResponse.json(
        {
          error: "عنوان محصول برای ساخت آدرس معتبر نیست",
        },
        { status: 400 },
      );
    }

    if (error?.code === "P2002") {
      return NextResponse.json(
        {
          error: "آدرس محصول تکراری است؛ دوباره تلاش کنید.",
        },
        { status: 409 },
      );
    }

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "دسته‌بندی موردنظر پیدا نشد" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ساخت محصول" },
      { status: 500 },
    );
  }
}
