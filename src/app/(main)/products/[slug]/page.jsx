import { notFound } from "next/navigation";
import ProductClient from "./ProductClient";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function absoluteUrl(path) {
  return new URL(path, BASE_URL).toString();
}

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const res = await fetch(`${BASE_URL}/api/products/${slug}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        title: "محصول پیدا نشد | برجک",
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const product = await res.json();

    const productUrl = absoluteUrl(`/products/${product.slug}`);

    return {
      title: product.title,
      description: product.description || `خرید ${product.title} از برجک`,

      keywords: [
        product.title,
        product.brand?.title,
        product.category?.title,
        "خرید",
        "قیمت",
        "برجک",
      ].filter(Boolean),

      alternates: {
        canonical: productUrl,
      },

      openGraph: {
        type: "website",
        title: product.title,
        description:
          product.description || `خرید ${product.title} از برجک`,
        url: productUrl,
        images: product.image
          ? [
              {
                url: absoluteUrl(product.image),
                width: 1200,
                height: 630,
                alt: product.title,
              },
            ]
          : [],
      },

      twitter: {
        card: "summary_large_image",
        title: product.title,
        description:
          product.description || `خرید ${product.title} از برجک`,
        images: product.image
          ? [absoluteUrl(product.image)]
          : [],
      },
    };
  } catch {
    return {
      title: "برجک",
    };
  }
}

export default async function Page({ params }) {
  const { slug } = await params;

  const res = await fetch(`${BASE_URL}/api/products/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    notFound();
  }

  const product = await res.json();

  const productUrl = absoluteUrl(`/products/${product.slug}`);

  const productImages = product.images?.length
    ? product.images
        .map((image) => image.url)
        .filter(Boolean)
        .map((image) => absoluteUrl(image))
    : product.image
      ? [absoluteUrl(product.image)]
      : [];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,

    ...(productImages.length
      ? {
          image: productImages,
        }
      : {}),

    ...(product.description
      ? {
          description: product.description,
        }
      : {}),

    ...(product.id
      ? {
          sku: String(product.id),
        }
      : {}),

    ...(product.brand?.title
      ? {
          brand: {
            "@type": "Brand",
            name: product.brand.title,
          },
        }
      : {}),

    ...(product.category?.title
      ? {
          category: product.category.title,
        }
      : {}),

    ...(product.reviewCount > 0 && product.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.rating),
            reviewCount: Number(product.reviewCount),
          },
        }
      : {}),

    ...(product.price != null
      ? {
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "IRR",
            price: Number(product.price),
            availability:
              product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  const breadcrumbItems = [
    {
      "@type": "ListItem",
      position: 1,
      name: "خانه",
      item: BASE_URL,
    },
  ];

  if (product.category?.title && product.category?.slug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: product.category.title,
      item: absoluteUrl(
        `/category/${product.category.slug}`
      ),
    });
  }

  if (product.brand?.title && product.brand?.slug) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: breadcrumbItems.length + 1,
      name: product.brand.title,
      item: absoluteUrl(
        `/brand/${product.brand.slug}`
      ),
    });
  }

  breadcrumbItems.push({
    "@type": "ListItem",
    position: breadcrumbItems.length + 1,
    name: product.title,
    item: productUrl,
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />

      <ProductClient params={params} />
    </>
  );
}