
"use client";

import Link from "next/link";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";

export default function RelatedProducts({ products }) {
  if (!products?.length) return null;

  return (
    <section className="mt-16 sm:mt-20">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl font-bold text-[var(--color-text)] sm:text-2xl">
          پیشنهاد ویژه برای شما
        </h2>
        <div className="mt-3 h-1 w-12 rounded-full bg-[var(--color-accent)]" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="card group flex h-full min-w-0 flex-col overflow-hidden border border-[var(--color-border)] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >

            <div className="relative aspect-square shrink-0 overflow-hidden bg-[var(--color-surface-2)]">
              {product.image ? (
                <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-5">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(max-width: 639px) 50vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, 25vw"
                    className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">
                  بدون تصویر
                </div>
              )}
            </div>


            <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
              <h3 className="line-clamp-2 min-h-12 break-words text-sm font-medium leading-6 text-[var(--color-text)]">
                {product.title}
              </h3>

              <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-2 pt-4">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                  <span className="text-sm font-bold text-[var(--color-text)] sm:text-base">
                    {toPersianPrice(product.price)}
                  </span>
                  <span className="shrink-0 text-[10px] text-[var(--color-text-muted)] sm:text-xs">
                    تومان
                  </span>
                </div>

                {product.rating != null && (
                  <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-accent)]">★</span>
                    {toPersianPrice(product.rating)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
