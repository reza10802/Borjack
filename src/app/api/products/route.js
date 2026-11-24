import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PUBLIC_PRODUCT_SCALARS } from "@/lib/public-product";

// نگاشت صفحه‌کلید انگلیسی به حروف فارسی
const PERSIAN_KEYBOARD_MAP = {
  q: "ض",
  w: "ص",
  e: "ث",
  r: "ق",
  t: "ف",
  y: "غ",
  u: "ع",
  i: "ه",
  o: "خ",
  p: "ح",
  "[": "ج",
  "]": "چ",

  a: "ش",
  s: "س",
  d: "ی",
  f: "ب",
  g: "ل",
  h: "ا",
  j: "ت",
  k: "ن",
  l: "م",
  ";": "ک",
  "'": "گ",

  z: "ظ",
  x: "ط",
  c: "ز",
  v: "ر",
  b: "ذ",
  n: "د",
  m: "ئ",
  ",": "و",
  "\\": "پ",
};

// کلمات مربوط به نام برند فروشگاه
const STORE_BRAND_WORDS = new Set([
  "برجک",
  "borjak",
  "borjack",
  "فروشگاه",
  "سایت",
  "وبشاپ",
  "shop",
  "store",
  "website",
]);

/**
 * تبدیل کلمه‌ای که با زبان انگلیسی به‌جای فارسی تایپ شده است.
 *
 * برای جلوگیری از تبدیل اشتباهی کلمات انگلیسی عادی،
 * فقط کلماتی تبدیل می‌شوند که حداقل دو نشانه خاص
 * از چیدمان صفحه‌کلید فارسی داشته باشند.
 *
 * نمونه:
 * fv[;     => برجک
 * ,fah\    => وبشاپ
 */
function convertKeyboardLayoutToken(token) {
  const specialKeys = token.match(/[\[\];,\\]/g) || [];

  if (specialKeys.length < 2) {
    return token;
  }

  return [...token]
    .map((character) => {
      const lowerCharacter = character.toLowerCase();

      return (
        PERSIAN_KEYBOARD_MAP[lowerCharacter] ??
        character
      );
    })
    .join("");
}

/**
 * نرمال‌سازی عبارت جست‌وجو.
 *
 * - اصلاح اشتباه زبان صفحه‌کلید
 * - یکسان‌سازی حروف عربی و فارسی
 * - شناسایی Borjak و Borjack
 * - شناسایی نام فارسی فروشگاه
 * - حذف نام فروشگاه از جست‌وجوهای ترکیبی
 *
 * اگر عبارت فقط نام فروشگاه باشد، رشته خالی برمی‌گرداند
 * تا API همه محصولات منتشرشده را نمایش دهد.
 */
function normalizeSearchQuery(value) {
  const originalQuery = String(value ?? "").trim();

  if (!originalQuery) {
    return "";
  }

  let normalized = originalQuery
    .split(/(\s+)/)
    .map((part) => {
      if (!part.trim()) {
        return part;
      }

      return convertKeyboardLayoutToken(part);
    })
    .join("");

  normalized = normalized
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  const tokens = normalized.toLowerCase().split(" ");

  const containsStoreBrand = tokens.some((token) =>
    ["برجک", "borjak", "borjack"].includes(token),
  );

  if (!containsStoreBrand) {
    return normalized;
  }

  // حذف نام برند و کلمات همراه آن
  // تا جست‌وجو روی نام محصول باقی‌مانده انجام شود.
  const remainingTokens = tokens.filter(
    (token) => !STORE_BRAND_WORDS.has(token),
  );

  return remainingTokens.join(" ").trim();
}

export async function GET(req) {
  try {
    const user = await getSessionUser();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const tag = searchParams.get("tag");
    const rawSearch = searchParams.get("search");
    const sort = searchParams.get("sort") || "default";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const onlyDiscount = searchParams.get("discount") === "true";
    const onlyInStock = searchParams.get("inStock") === "true";

    const page = Number(searchParams.get("page") ?? 1);
    const limit = Number(searchParams.get("limit") ?? 20);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100 ||
      !Number.isSafeInteger((page - 1) * limit)
    ) {
      return NextResponse.json(
        { error: "شماره صفحه یا تعداد نتایج معتبر نیست" },
        { status: 400 },
      );
    }

    const skip = (page - 1) * limit;

    if (
      (minPrice !== null &&
        (!Number.isFinite(Number(minPrice)) ||
          Number(minPrice) < 0)) ||
      (maxPrice !== null &&
        (!Number.isFinite(Number(maxPrice)) ||
          Number(maxPrice) < 0))
    ) {
      return NextResponse.json(
        { error: "محدوده قیمت معتبر نیست" },
        { status: 400 },
      );
    }

    if (
      minPrice !== null &&
      maxPrice !== null &&
      Number(minPrice) > Number(maxPrice)
    ) {
      return NextResponse.json(
        {
          error:
            "حداقل قیمت نمی‌تواند از حداکثر قیمت بیشتر باشد",
        },
        { status: 400 },
      );
    }

    // اصلاح عبارت قبل از ساخت شرط جست‌وجوی دیتابیس
    const normalizedSearch = normalizeSearchQuery(rawSearch);

    const where = {
      isPublished: true,
      deletedAt: null,
    };

    if (category) {
      where.category = {
        title: category,
      };
    }

    if (brand) {
      where.brand = {
        title: brand,
      };
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            title: tag,
          },
        },
      };
    }

    // اگر عبارت فقط نام فروشگاه باشد، جست‌وجوی متنی اعمال نمی‌شود
    // و همه محصولات منتشرشده با رعایت سایر فیلترها نمایش داده می‌شوند.
    if (normalizedSearch) {
      const compactSearch = normalizedSearch
        .replace(/[\s\u200c]+/g, "")
        .toLowerCase();

      const searchTerms = new Set([normalizedSearch]);

      // پشتیبانی از شکل‌های مختلف نوشتن لپ‌تاپ
      if (
        ["لپتاپ", "laptop", "notebook"].includes(compactSearch)
      ) {
        [
          "لپ تاپ",
          "لپ‌تاپ",
          "لپتاپ",
          "laptop",
          "notebook",
        ].forEach((term) => searchTerms.add(term));
      }

      where.OR = [...searchTerms].flatMap((term) => [
        {
          title: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: term,
            mode: "insensitive",
          },
        },
        {
          brand: {
            title: {
              contains: term,
              mode: "insensitive",
            },
          },
        },
        {
          category: {
            title: {
              contains: term,
              mode: "insensitive",
            },
          },
        },
        {
          tags: {
            some: {
              tag: {
                title: {
                  contains: term,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ]);
    }

    if (onlyDiscount) {
      where.discount = {
        gt: 0,
      };
    }

    // فیلتر موجودی آزاد قبل از count و pagination
    if (onlyInStock) {
      const availableProductIds = await prisma.$queryRaw`
        SELECT "id"
        FROM "Product"
        WHERE "isPublished" = TRUE
          AND "deletedAt" IS NULL
          AND "stock" > "reservedStock"
      `;

      where.id = {
        in: availableProductIds.map((product) => product.id),
      };
    }

    if (minPrice !== null || maxPrice !== null) {
      where.price = {};

      if (minPrice !== null) {
        where.price.gte = Number(minPrice);
      }

      if (maxPrice !== null) {
        where.price.lte = Number(maxPrice);
      }
    }

    let orderBy = { createdAt: "desc" };

    if (sort === "price-asc") {
      orderBy = { price: "asc" };
    } else if (sort === "price-desc") {
      orderBy = { price: "desc" };
    } else if (sort === "rating") {
      orderBy = { rating: "desc" };
    } else if (sort === "discount") {
      orderBy = { discount: "desc" };
    }

    const total = await prisma.product.count({
      where,
    });

    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        ...PUBLIC_PRODUCT_SCALARS,
        category: true,
        brand: true,
        images: true,
        specs: true,
        tags: {
          include: {
            tag: true,
          },
        },
        ...(user
          ? {
              wishlistItems: {
                where: {
                  userId: user.id,
                },
                select: {
                  id: true,
                },
              },
            }
          : {}),
      },
    });

    const normalized = products.map((product) => {
      const {
        stock,
        reservedStock,
        wishlistItems,
        ...publicProduct
      } = product;

      const availableStock =
        Number.isSafeInteger(stock) &&
        Number.isSafeInteger(reservedStock)
          ? Math.max(0, stock - reservedStock)
          : 0;

      return {
        ...publicProduct,
        image: product.images?.[0]?.url || product.image,
        availableStock,
        isWishlisted: user
          ? (wishlistItems?.length ?? 0) > 0
          : false,
      };
    });

    return NextResponse.json(
      {
        products: normalized,
        pagination: {
          total,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          limit,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}