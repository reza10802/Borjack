import Link from "next/link";
import ProductCard from "./ProductCard";

async function getProducts() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/products`, {
        cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
}

export default async function ProductGrid() {
    const products = await getProducts();

    return (
        <section className="mb-10">
            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">جدیدترین محصولات</h2>
                <Link href="/search" className="text-sm text-gray-500 hover:text-black transition">
                    مشاهده همه ←
                </Link>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>
        </section>
    );
}