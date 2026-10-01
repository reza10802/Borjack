import { prisma } from "@/lib/db";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export default async function sitemap() {
  const [products, categories, brands] = await Promise.all([
    prisma.product.findMany({
      where: {
        isPublished: true,
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    }),

    prisma.category.findMany({
      select: {
        slug: true,
      },
    }),

    prisma.brand.findMany({
      select: {
        slug: true,
      },
    }),
  ]);

  const productUrls = products.map((product) => ({
    url: `${BASE_URL}/products/${encodeURIComponent(product.slug)}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryUrls = categories.map((category) => ({
    url: `${BASE_URL}/category/${encodeURIComponent(category.slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const brandUrls = brands.map((brand) => ({
    url: `${BASE_URL}/brand/${encodeURIComponent(brand.slug)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      changeFrequency: "daily",
      priority: 1,
    },

    ...categoryUrls,
    ...brandUrls,
    ...productUrls,
  ];
}
