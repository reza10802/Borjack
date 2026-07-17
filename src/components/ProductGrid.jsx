import Link from "next/link";
import ProductCard from "./ProductCard";
import { prisma } from "@/lib/db";

async function getProducts() {
  const products = await prisma.product.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      images: true,
      specs: true,
    },
  });

  return products.map((product) => ({
    ...product,
    image: product.images?.[0]?.url || product.image,
    isWishlisted: false,
  }));
}

export default async function ProductGrid() {
  const products = await getProducts();

  return (
    <section className="mb-10">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">جدیدترین محصولات</h2>
        <Link
          href="/search"
          className="text-sm text-gray-500 transition hover:text-black"
        >
          مشاهده همه ←
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
          محصولی برای نمایش وجود ندارد
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}