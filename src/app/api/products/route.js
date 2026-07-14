import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req) {
  try {
    const user = await getSessionUser();

    const { searchParams } = new URL(req.url);

    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "default";
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const onlyDiscount = searchParams.get("discount") === "true";
    const onlyInStock = searchParams.get("inStock") === "true";

    const where = {};

    if (category) where.category = category;
    if (search) where.title = { contains: search };
    if (onlyDiscount) where.discount = { gt: 0 };
    if (onlyInStock) where.inStock = true;

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

    const products = await prisma.product.findMany({
      where,
      orderBy,
      include: {
        images: true,
        specs: true,
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

    return NextResponse.json(normalized);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 }
    );
  }
}