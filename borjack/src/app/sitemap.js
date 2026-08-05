const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

import { prisma } from "@/lib/db";

export default async function sitemap() {
  const products = await prisma.product.findMany({
    select: {
      slug: true,
      updatedAt: true,
    },
    where: {
      isPublished: true,
    },
  });

  const productUrls = products.map((product) => ({
    url: `${BASE_URL}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },

    {
      url: `${BASE_URL}/products`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },

    ...productUrls,
  ];
}