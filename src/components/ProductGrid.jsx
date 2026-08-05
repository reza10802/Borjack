import Link from "next/link";
import ProductCard from "./ProductCard";
import { prisma } from "@/lib/db";

async function getProducts() {
  const products = await prisma.product.findMany({
    where: {
      isPublished: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    include: {
      images: true,
      specs: true,
      category: true,
      brand: true,
    },
  });

  return products.map((product) => ({
    ...product,
    image: product.images?.[0]?.url || product.image,
    isWishlisted: false,

    category: product.category?.title,
    brand: product.brand?.title ?? null,
  }));
}

export default async function ProductGrid() {
  const products = await getProducts();

  return (
    <section className="py-10">
      <div className="mb-8 flex items-end justify-between">
        <h2 className="section-title relative inline-block">
          جدیدترین محصولات
          <span className="absolute -bottom-2 right-0 h-1 w-14 rounded-full bg-orange-500"></span>
        </h2>
        <Link
          href="/search"
          className=" text-sm font-medium text-orange-500 transition hover:text-orange-600 "
        >
          مشاهده همه ←
        </Link>
      </div>

      {products.length === 0 ? (
        <div className=" card py-14 text-center text-zinc-500 dark:text-zinc-400 ">
          محصولی برای نمایش وجود ندارد
        </div>
      ) : (
        <>
          <p className="muted mt-2 mb-6 text-sm">
            جدیدترین کالاهای اضافه شده به فروشگاه
          </p>
          <div className=" grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 ">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>

      )}
    </section>
  );
}