
import { cache } from "react";
import { notFound } from "next/navigation";

import ProductClient from "./ProductClient";
import { safeJsonLd } from "@/lib/json-ld";

const BASE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site"
).replace(/\/+$/, "");

const PRICE_CURRENCY = "IRR";

function absoluteUrl(path) {
  return new URL(path, `${BASE_URL}/`).toString();
}

// Fetch the product once per server render.
// The API must return only published, non-deleted public products.
const getProduct = cache(async (slug) => {
  const response = await fetch(
    `${BASE_URL}/api/products/${encodeURIComponent(slug)}`,
    {
      cache: "no-store",
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Product request failed: ${response.status}`);
  }

  return response.json();
});

function getAvailableStock(value) {
  const stock = Number(value);

  if (!Number.isSafeInteger(stock) || stock < 0) {
    return 0;
  }

  return stock;
}

function getValidPrice(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return null;
  }

  return price;
}

function getProductImages(product) {
  const images = Array.isArray(product.images)
    ? product.images
        .map((image) => image?.url)
        .filter((url) => typeof url === "string" && url.length > 0)
    : [];

  const imageList =
    images.length > 0
      ? images
      : product.image
        ? [product.image]
        : [];

  return [...new Set(imageList.map(absoluteUrl))];
}

function createProductJsonLd(product, productUrl) {
  const availableStock = getAvailableStock(product.availableStock);
  const price = getValidPrice(product.price);
  const productImages = getProductImages(product);

  const rating = Number(product.rating);
  const reviewCount = Number(product.reviewCount);

  // Only use ratings that are valid and actually visible to customers.
  const hasValidRating =
    Number.isFinite(rating) &&
    rating >= 1 &&
    rating <= 5 &&
    Number.isSafeInteger(reviewCount) &&
    reviewCount > 0;

  const productData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    url: productUrl,

    ...(productImages.length > 0 && {
      image: productImages,
    }),

    ...(product.description && {
      description: product.description,
    }),

    ...(product.sku || product.id
      ? {
          sku: String(product.sku || product.id),
        }
      : {}),

    ...(product.brand?.title && {
      brand: {
        "@type": "Brand",
        name: product.brand.title,
      },
    }),

    ...(product.category?.title && {
      category: product.category.title,
    }),

    ...(hasValidRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  if (price !== null) {
    productData.offers = {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: PRICE_CURRENCY,
      price,
      availability:
        availableStock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
    };
  }

  return productData;
}

function createBreadcrumbJsonLd(product, productUrl) {
  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "خانه",
      item: absoluteUrl("/"),
    },
  ];

  if (product.category?.title && product.category?.slug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: product.category.title,
      item: absoluteUrl(
        `/category/${encodeURIComponent(product.category.slug)}`
      ),
    });
  }

  breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbItems.length + 1,
    name: product.title,
    item: productUrl,
  });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const product = await getProduct(slug);

    if (!product) {
      return {
        title: "محصول پیدا نشد",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const productUrl = absoluteUrl(
      `/products/${encodeURIComponent(product.slug)}`
    );

    const description =
      product.description || `خرید ${product.title} از فروشگاه برجک`;

    const productImages = getProductImages(product);

    return {
      title: product.title,
      description,

      alternates: {
        canonical: productUrl,
      },

      openGraph: {
        type: "website",
        locale: "fa_IR",
        siteName: "برجک",
        title: product.title,
        description,
        url: productUrl,
        ...(productImages.length > 0 && {
          images: [
            {
              url: productImages[0],
              width: 1200,
              height: 630,
              alt: product.title,
            },
          ],
        }),
      },

      twitter: {
        card: "summary_large_image",
        title: product.title,
        description,
        ...(productImages.length > 0 && {
          images: [productImages[0]],
        }),
      },
    };
  } catch (error) {
    console.error("Failed to generate product metadata:", error);

    return {
      title: "محصول",
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;

  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  const productUrl = absoluteUrl(
    `/products/${encodeURIComponent(product.slug)}`
  );

  const productJsonLd = createProductJsonLd(product, productUrl);

  const breadcrumbJsonLd = createBreadcrumbJsonLd(
    product,
    productUrl
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(productJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(breadcrumbJsonLd),
        }}
      />

      <ProductClient product={product} />
    </>
  );
}
