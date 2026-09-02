"use client";

import Link from "next/link";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";

export default function SpecialOfferMobileCard({ product }) {
    return (
        <Link
            href={`/products/${product.slug}`}
            className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm"
        >
            {/* Image */}

            <div className="relative h-52 overflow-hidden">

                <Image
                    src={product.image}
                    fill
                    alt={product.title}
                    className="object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                {product.discount > 0 && (
                    <span className="absolute right-3 top-3 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-bold text-white shadow-lg">
                        %{toPersianPrice(product.discount)}
                    </span>
                )}
            </div>

            {/* Body */}

            <div className="p-5">

                <h3 className="line-clamp-2 text-base font-black leading-7 text-[var(--color-primary)] dark:text-white">
                    {product.title}
                </h3>

                <div className="mt-3 flex items-center justify-between text-xs">

                    <span className="text-zinc-500">
                        {product.brand?.title}
                    </span>

                    <span className="flex items-center gap-1">
                        ⭐ {product.rating}
                    </span>

                    <span
                        className={
                            product.stock > 0
                                ? "text-green-600 font-semibold"
                                : "text-red-500 font-semibold"
                        }
                    >
                        {product.stock > 0 ? "موجود" : "ناموجود"}
                    </span>

                </div>

                <div className="mt-5 flex items-end justify-between">

                    <div>

                        {product.discount > 0 && (
                            <div className="text-xs text-zinc-400 line-through">
                                {toPersianPrice(product.originalPrice)} تومان
                            </div>
                        )}

                        <div className="mt-1 text-2xl font-black text-[var(--color-primary)] dark:text-[var(--color-accent)]">
                            {toPersianPrice(product.price)}
                            <span className="mr-1 text-sm font-bold">
                                تومان
                            </span>
                        </div>

                    </div>

                    <button
                        className="btn-primary h-11 rounded-xl px-5 text-sm shrink-0"
                    >
                        خرید
                    </button>

                </div>

            </div>

        </Link>
    );
}