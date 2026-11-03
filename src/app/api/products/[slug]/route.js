import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

function getAvailableStock(product) {
  const stock = Number(product?.stock ?? 0);
  const reservedStock = Number(product?.reservedStock ?? 0);

  if (
    !Number.isSafeInteger(stock) ||
    !Number.isSafeInteger(reservedStock)
  ) {
    return 0;
  }

  return Math.max(0, stock - reservedStock);
}

export async function GET(req, { params }) {
  try {
    const user = await getSessionUser(req);
    const { slug } = await params;

    // دریافت محصول؛ محصولات آرشیوشده قابل مشاهده نیستند.
    const product = await prisma.product.findFirst({
      where: {
        slug,
        deletedAt: null,
        isPublished: true,
      },
      include: {
        category: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        brand: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        images: {
          orderBy: {
            id: "asc",
          },
        },
        specs: true,
        tags: {
          include: {
            tag: true,
          },
        },
        reviews: {
          where: {
            approved: true,
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
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

    if (!product) {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    const tagIds = product.tags.map((t) => t.tagId);

    // محصولات مرتبط نباید آرشیوشده یا منتشرنشده باشند.
    const relatedProducts = await prisma.product.findMany({
      where: {
        id: {
          not: product.id,
        },
        deletedAt: null,
        isPublished: true,

        OR: [
          {
            categoryId: product.categoryId,
          },

          ...(product.brandId
            ? [
                {
                  brandId: product.brandId,
                },
              ]
            : []),

          ...(tagIds.length
            ? [
                {
                  tags: {
                    some: {
                      tagId: {
                        in: tagIds,
                      },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      include: {
        images: true,
        tags: true,
      },
      take: 8,
    });

    const scoredProducts = relatedProducts.map((item) => {
      let score = 0;

      if (item.categoryId === product.categoryId) {
        score += 10;
      }

      if (
        product.brandId &&
        item.brandId &&
        item.brandId === product.brandId
      ) {
        score += 6;
      }

      const commonTags = item.tags.filter((tag) =>
        tagIds.includes(tag.tagId),
      ).length;

      score += commonTags * 3;
      score += item.rating * 2;
      score += item.reviewCount / 20;

      // اولویت بیشتر برای محصولاتی که واقعاً قابل خرید هستند.
      const availableStock = getAvailableStock(item);

      if (availableStock > 0) {
        score += 5;
      }

      if (item.discount > 0) {
        score += 2;
      }

      return {
        ...item,
        availableStock,
        score,
      };
    });

    scoredProducts.sort((a, b) => b.score - a.score);

    const finalRelated = scoredProducts
      .slice(0, 4)
      .map((item) => ({
        id: item.id,
        title: item.title,
        price: item.price,
        discount: item.discount,
        rating: item.rating,
        reviewCount: item.reviewCount,
        availableStock: item.availableStock,
        image: item.images?.[0]?.url || item.image,
        slug: item.slug,
      }));

    // مقدار reservedStock را در API عمومی افشا نمی‌کنیم.
    const publicProduct = { ...product };
    delete publicProduct.reservedStock;

    const normalized = {
      ...publicProduct,
      image: product.images?.[0]?.url || product.image,
      availableStock: getAvailableStock(product),
      isWishlisted: user
        ? product.wishlistItems.length > 0
        : false,
      relatedProducts: finalRelated,
      hasReviews: product.reviewCount > 0,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET PRODUCT BY SLUG ERROR:", error);

    return NextResponse.json(
      { error: "خطا در دریافت محصول" },
      { status: 500 },
    );
  }
}