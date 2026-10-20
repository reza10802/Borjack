
"use client";

import Link from "next/link";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";

export default function SpecialOfferMobileCard({ product }) {
    const hasDiscount =
        Number(product.discount) > 0 &&
        Number(product.originalPrice) > Number(product.price);

    const isAvailable = Number(product.stock) > 0;

    return (
        <Link
            href={`/products/${product.slug}`}
            dir="rtl"
            className="
                group block min-w-0 overflow-hidden
                rounded-2xl
                border border-[var(--color-border)]
                bg-[var(--color-surface)]
                text-[var(--color-text)]
                transition-shadow duration-200
                hover:shadow-md
            "
        >
            {/* Product image */}
            <div className="relative aspect-square overflow-hidden bg-[var(--color-surface-2)]">
                {product.image && (
                    <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        sizes="(max-width: 768px) 85vw, 320px"
                        className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
                    />
                )}

                {hasDiscount && (
                    <span
                        className="
                            absolute right-3 top-3
                            rounded-md
                            bg-[var(--color-accent)]
                            px-2 py-1
                            text-xs font-bold text-white
                        "
                    >
                        {toPersianPrice(product.discount)}٪
                    </span>
                )}
            </div>

            {/* Product information */}
            <div className="p-3 sm:p-4">
                {/* Brand and rating */}
                <div className="
                    mb-2 flex items-center justify-between gap-2
                    text-xs text-[var(--color-text-muted)]
                ">
                    <span className="min-w-0 truncate">
                        {product.brand?.title || ""}
                    </span>

                    {product.rating != null && (
                        <span className="shrink-0">
                            <span className="text-[var(--color-accent)]">
                                ★
                            </span>{" "}
                            {toPersianPrice(product.rating)}
                        </span>
                    )}
                </div>

                {/* Title */}
                <h3
                    className="
                        line-clamp-2 min-h-12
                        text-sm font-medium leading-6
                        text-[var(--color-text)]
                    "
                >
                    {product.title}
                </h3>

                {/* Availability */}
                <div className="
                    mt-2 text-xs
                    text-[var(--color-text-muted)]
                ">
                    {isAvailable ? "موجود در انبار" : "ناموجود"}
                </div>

                {/* Price */}
                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                    {hasDiscount && (
                        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                            <span className="line-through">
                                {toPersianPrice(product.originalPrice)}
                            </span>
                            <span>تومان</span>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-baseline gap-1">
                            <span className="text-lg font-bold tracking-tight text-[var(--color-text)]">
                                {toPersianPrice(product.price)}
                            </span>
                            <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">
                                تومان
                            </span>
                        </div>

                        <span
                            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium ${isAvailable
                                ? "btn-primary"
                                : "border border-[var(--color-border)] text-[var(--color-text-muted)]"
                                }`}
                        >
                            مشاهده
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}
