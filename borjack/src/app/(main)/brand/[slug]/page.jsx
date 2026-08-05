import ProductCard from "@/components/ProductCard";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";

async function getBrand(slug) {
    return prisma.brand.findUnique({
        where: {
            slug,
        },
    });
}

async function getProducts(brandId) {
    const products = await prisma.product.findMany({
        where: {
            isPublished: true,
            brandId,
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

export default async function BrandPage({ params }) {
    const { slug } = await params;

    const brand = await getBrand(slug);

    if (!brand) notFound();

    const products = await getProducts(brand.id);

    return (
        <div className="container-page py-10">
            <Breadcrumb
                items={[
                    {
                        label: "برندها",
                        href: "/brands",
                    },
                    {
                        label: brand.title,
                    },
                ]}
            />
            <div className="mb-10">
                <h1 className="section-title">
                    محصولات برند {brand.title}
                </h1>

                <p className="muted mt-2">
                    {products.length} محصول
                </p>
            </div>

            {products.length === 0 ? (
                <div className="card py-16 text-center text-zinc-500">
                    محصولی برای این برند وجود ندارد.
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