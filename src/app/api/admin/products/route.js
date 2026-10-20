
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";

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
      stock = 0,
      specs = [],
    } = body;

    // اعتبارسنجی فیلدهای ضروری
    if (
      typeof title !== "string" ||
      !title.trim() ||
      price == null ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      !Number.isFinite(Number(categoryId)) ||
      Number(categoryId) <= 0 ||
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

    // اعتبارسنجی گالری تصاویر

    // اعتبارسنجی گالری تصاویر: حداکثر ۴ عکس گالری + ۱ عکس اصلی
    if (
      !Array.isArray(gallery) ||
      gallery.length > 4 ||
      gallery.some(
        (url) => typeof url !== "string" || !url.trim(),
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

    // ایجاد محصول به همراه تصاویر و مشخصات فنی
    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        slug,
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
        stock: Number(stock) || 0,

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
    await logAction({
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

    if (error.message === "INVALID_PRODUCT_SLUG") {
      return NextResponse.json(
        { error: "عنوان محصول برای ساخت آدرس معتبر نیست" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ساخت محصول" },
      { status: 500 },
    );
  }
}
