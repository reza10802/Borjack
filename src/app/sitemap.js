
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site"
).replace(/\/+$/, "");

const publishedProductWhere = {
  isPublished: true,
  deletedAt: null,
};

export default async function sitemap() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        ...publishedProductWhere,
        slug: {
          not: null,
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),

    prisma.category.findMany({
      where: {
        products: {
          some: publishedProductWhere,
        },
      },
      select: {
        slug: true,
      },
    }),

    prisma.brand.findMany({
      where: {
        products: {
          some: publishedProductWhere,
        },
      },
      select: {
        slug: true,
      },
    }),
  ]);

  const staticUrls = [
    {
      url: `${BASE_URL}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/rules`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const productUrls = products.map((product) => ({
    url: `${BASE_URL}/products/${encodeURIComponent(product.slug)}`,
    lastModified: product.updatedAt,
  }));

  const categoryUrls = categories.map((category) => ({
    url: `${BASE_URL}/category/${encodeURIComponent(category.slug)}`,
  }));

  const brandUrls = brands.map((brand) => ({
    url: `${BASE_URL}/brand/${encodeURIComponent(brand.slug)}`,
  }));

  return [
    {
      url: `${BASE_URL}/`,
    },

    ...staticUrls,
    ...categoryUrls,
    ...brandUrls,
    ...productUrls,
  ];
}
