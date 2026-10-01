import Breadcrumb from "@/components/Breadcrumb";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

const BASE_URL =
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

function decodeSlug(value) {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

async function getCategory(slug) {
    return prisma.category.findUnique({
        where: {
            slug,
        },
    });
}

async function getProducts(categoryId) {
    const products = await prisma.product.findMany({
        where: {
            isPublished: true,
            categoryId,
        },
        include: {
            brand: true,
            images: true,
            specs: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return products.map((product) => ({
        ...product,
        image: product.images?.[0]?.url || product.image,
        isWishlisted: false,
    }));
}

export async function generateMetadata({ params }) {
    const { slug: rawSlug } = await params;
    const slug = decodeSlug(rawSlug);

    const category = await getCategory(slug);

    if (!category) {
        return {
            title: "دسته‌بندی پیدا نشد",
            robots: {
                index: false,
                follow: true,
            },
        };
    }

    const categoryUrl = `${BASE_URL}/category/${encodeURIComponent(
        category.slug
    )}`;

    return {
        title: `خرید ${category.title}`,

        description: `خرید محصولات ${category.title} با مشاهده قیمت و مشخصات در برجک.`,

        alternates: {
            canonical: categoryUrl,
        },

        openGraph: {
            type: "website",
            title: `خرید ${category.title}`,
            description: `خرید محصولات ${category.title} با مشاهده قیمت و مشخصات در برجک.`,
            url: categoryUrl,
        },
    };
}

export default async function CategoryPage({ params }) {
    const { slug: rawSlug } = await params;
    const slug = decodeSlug(rawSlug);

    const category = await getCategory(slug);

    if (!category) {
        notFound();
    }

    const products = await getProducts(category.id);

    const categoryUrl = `${BASE_URL}/category/${encodeURIComponent(
        category.slug
    )}`;

    const breadcrumbJsonLd = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
            {
                "@type": "ListItem",
                position: 1,
                name: "خانه",
                item: BASE_URL,
            },
            {
                "@type": "ListItem",
                position: 2,
                name: category.title,
                item: categoryUrl,
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

            <div className="container-page py-10">
                <Breadcrumb
                    items={[
                        {
                            label: category.title,
                        },
                    ]}
                />

                <div className="mb-10">
                    <h1 className="section-title">
                        محصولات دسته {category.title}
                    </h1>

                    <p className="muted mt-2">
                        {products.length} محصول
                    </p>
                </div>

                {products.length === 0 ? (
                    <div className="card py-16 text-center text-zinc-500">
                        محصولی برای این دسته وجود ندارد.
                    </div>
                ) : (
                    <div className="grid gap-7 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {products.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
