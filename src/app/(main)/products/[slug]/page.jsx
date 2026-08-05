import ProductClient from "./ProductClient";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({ params }) {
  const { slug } = await params;

  try {
    const res = await fetch(`${BASE_URL}/api/products/${slug}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        title: "محصول پیدا نشد",
      };
    }

    const product = await res.json();
    const productJsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",

      name: product.title,

      image: product.images?.length
        ? product.images.map((i) => i.url)
        : [product.image],

      description: product.description,

      sku: product.id.toString(),

      brand: {
        "@type": "Brand",
        name: product.brand.title,
      },

      category: product.category.title,

      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      },

      offers: {
        "@type": "Offer",
        priceCurrency: "IRR",
        price: product.price,
        availability:
          product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
      },
    };
    return {
      title: product.title,

      description: product.description,

      keywords: [
        product.title,
        product.brand?.title,
        product.category?.title,
        "خرید",
        "قیمت",
        "برجک",
      ].filter(Boolean),

      alternates: {
        canonical: `${BASE_URL}/products/${product.slug}`,
      },

      openGraph: {
        title: product.title,
        description: product.description,
        url: `${BASE_URL}/products/${product.slug}`,

        images: [
          {
            url: product.image,
            width: 1200,
            height: 630,
          },
        ],
      },

      twitter: {
        card: "summary_large_image",
        title: product.title,
        description: product.description,
        images: [product.image],
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

  const product = await res.json();
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",

    name: product.title,

    image: product.images?.length
      ? product.images.map((i) => i.url)
      : [product.image],

    description: product.description,

    sku: product.id.toString(),

    brand: {
      "@type": "Brand",
      name: product.brand?.title,
    },

    category: product.category?.title,

    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },

    offers: {
      "@type": "Offer",
      priceCurrency: "IRR",
      price: product.price,
      availability:
        product.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "خانه",
        item: `${BASE_URL}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "محصولات",
        item: `${BASE_URL}/products`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.category.title,
        item: `${BASE_URL}/products?category=${product.category.slug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: product.title,
        item: `${BASE_URL}/products/${product.slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd),
        }}
      />

      <ProductClient params={params} />
    </>
  );
}