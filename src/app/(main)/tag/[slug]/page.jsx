import Breadcrumb from "@/components/Breadcrumb";
import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { PUBLIC_CARD_SELECT, toPublicCardProduct } from "@/lib/public-product";

async function getTag(slug) {
    return prisma.tag.findUnique({
        where: {
            slug,
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

    if (!tag) notFound();

    const products = await getProducts(tag.id);

    return (
        <div className="container-page py-10">
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
            <div className="mb-10">
                <h1 className="section-title">
                    محصولات برچسب {tag.title}
                </h1>

                <p className="muted mt-2">
                    {products.length} محصول
                </p>
            </div>

            {products.length === 0 ? (
                <div className="card py-16 text-center text-zinc-500">
                    محصولی برای این برچسب وجود ندارد.
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
    );
}