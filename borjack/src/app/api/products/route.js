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

    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const skip = (page - 1) * limit;

    const where = {
      isPublished: true,
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
    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          brand: {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          tags: {
            some: {
              tag: {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ];
    }
    if (onlyDiscount) where.discount = { gt: 0 };
    if (onlyInStock) {
      where.stock = {
        gt: 0,
      };
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    let orderBy = { createdAt: "desc" };
    if (sort === "price-asc") orderBy = { price: "asc" };
    if (sort === "price-desc") orderBy = { price: "desc" };
    if (sort === "rating") orderBy = { rating: "desc" };
    if (sort === "discount") orderBy = { discount: "desc" };

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
                where: { userId: user.id },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    const normalized = products.map((product) => ({
      ...product,
      image: product.images?.[0]?.url || product.image,
      isWishlisted: user ? product.wishlistItems.length > 0 : false,
    }));

    return NextResponse.json({
      products: normalized,
      pagination: {
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}
