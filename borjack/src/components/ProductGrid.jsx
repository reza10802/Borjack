import ProductCard from "./ProductCard";

export default function ProductGrid() {
    return (
        <section className="mb-10">

            <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                    جدیدترین محصولات
                </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">

                <ProductCard />
                <ProductCard />
                <ProductCard />
                <ProductCard />
                <ProductCard />

            </div>

        </section>
    )
}
