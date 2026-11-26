
import Breadcrumb from "@/components/Breadcrumb";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PUBLIC_CARD_SELECT, toPublicCardProduct } from "@/lib/public-product";

export const metadata = {
    title: "برچسب محصولات",
    description: "مشاهده محصولات فروشگاه اینترنتی برجک بر اساس برچسب.",
    robots: {
        index: false,
        follow: true,
    },
};

async function getTag(slug) {
    return prisma.tag.findUnique({
        where: { slug },
        select: {
            id: true,
            title: true,
            slug: true,
        },
    });
}

async function getProducts(tagId) {
    const products = await prisma.product.findMany({
        where: {
            isPublished: true,
            deletedAt: null,
            tags: {
                some: {
                    tagId,
                },
            },
        },
        select: PUBLIC_CARD_SELECT,
        orderBy: {
            createdAt: "desc",
        },
    });

    return products.map(toPublicCardProduct);
}

export default async function TagPage({ params }) {
    const { slug } = await params;

    const tag = await getTag(slug);

    if (!tag) {
        notFound();
    }

    const products = await getProducts(tag.id);

    return (
        <main className="container-page py-10">
            <Breadcrumb
                items={[
                    {
                        label: "برچسب‌ها",
                        href: "/tags",
                    },
                    {
                        label: tag.title,
                    },
                ]}
            />

            <header className="mb-10">
                <h1 className="section-title">
                    محصولات برچسب {tag.title}
                </h1>

                <p className="muted mt-2">
                    {products.length.toLocaleString("fa-IR")} محصول
                </p>
            </header>

            {products.length === 0 ? (
                <div className="card py-16 text-center text-zinc-500">
                    محصول منتشرشده‌ای برای این برچسب وجود ندارد.
                </div>
            ) : (
                <section
                    aria-label={`محصولات برچسب ${tag.title}`}
                    className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                >
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                        />
                    ))}
                </section>
            )}
        </main>
    );
}
