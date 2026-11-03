
import Link from "next/link";
import ProductCard from "./ProductCard";
import { prisma } from "@/lib/db";

async function getProducts() {
  const products = await prisma.product.findMany({
    where: {
      isPublished: true,
      deletedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      originalPrice: true,
      discount: true,
      stock: true,
      reservedStock: true,
      image: true,
      rating: true,
      reviewCount: true,
      images: {
        take: 1,
        orderBy: {
          id: "asc",
        },
        select: {
          url: true,
        },
      },
      category: {
        select: {
          title: true,
        },
      },
      brand: {
        select: {
          title: true,
        },
      },
    },
  });

  return products.map((product) => {
    const stock = Number(product.stock);
    const reservedStock = Number(product.reservedStock);

    const availableStock =
      Number.isSafeInteger(stock) &&
      Number.isSafeInteger(reservedStock)
        ? Math.max(0, stock - reservedStock)
        : 0;

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      originalPrice: product.originalPrice,
      discount: product.discount,
      availableStock,
      image: product.images?.[0]?.url || product.image,
      rating: product.rating,
      reviewCount: product.reviewCount,
      isWishlisted: false,
      category: product.category?.title ?? null,
      brand: product.brand
        ? { title: product.brand.title }
        : null,
    };
  });
}

export default async function ProductGrid() {
  const products = await getProducts();

  return (
    <section className="py-10">
      <div className="mb-8 flex items-end justify-between">
        <h2 className="section-title relative inline-block">
          جدیدترین محصولات
          <span className="absolute -bottom-2 right-0 h-1 w-14 rounded-full bg-[var(--color-accent)]" />
        </h2>

        <Link
          href="/search"
          className="text-sm font-medium text-[var(--color-accent)] transition hover:opacity-75"
        >
          مشاهده همه ←
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="card py-14 text-center text-zinc-500 dark:text-zinc-400">
          محصولی برای نمایش وجود ندارد
        </div>
      ) : (
        <>
          <p className="muted mb-6 mt-2 text-sm">
            جدیدترین کالاهای اضافه شده به فروشگاه
          </p>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
