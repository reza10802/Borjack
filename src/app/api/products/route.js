import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req) {
  try {
    const user = await getSessionUser();
    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const brand = searchParams.get("brand");
    const tag = searchParams.get("tag");
    const search = searchParams.get("search");
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
        { error: "حداقل قیمت نمی‌تواند از حداکثر قیمت بیشتر باشد" },
        { status: 400 },
      );
    }

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

    if (search?.trim()) {
      const normalizedSearch = search
        .trim()
        .replace(/ي/g, "ی")
        .replace(/ك/g, "ک");

      const compactSearch = normalizedSearch
        .replace(/[\s\u200c]+/g, "")
        .toLowerCase();

      const searchTerms = new Set([normalizedSearch]);

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
      include: {
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