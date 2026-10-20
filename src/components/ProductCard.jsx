
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  BookmarkIcon as BookmarkOutline,
} from "@heroicons/react/24/outline";
import {
  BookmarkIcon as BookmarkSolid,
} from "@heroicons/react/24/solid";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export default function ProductCard({
  product,
  variant = "default",
}) {
  const isSearchVariant = variant === "search";

  const {
    id,
    slug,
    title,
    brand,
    stock,
    price,
    originalPrice,
    discount,
    image,
    rating,
    reviewCount,
    isWishlisted = false,
  } = product;

  const { user } = useAuth();
  const router = useRouter();
  const { addToCart } = useCart();

  const [liked, setLiked] = useState(isWishlisted);
  const [loading, setLoading] = useState(false);

  const hasDiscount =
    Number(discount) > 0 &&
    Number(originalPrice) > Number(price);

  const toggleWishlist = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      router.push("/login");
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (liked) {
        const res = await fetch(`/api/wishlist/${id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setLiked(false);
          window.dispatchEvent(
            new Event("wishlist-updated")
          );
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: id,
          }),
        });

        if (res.ok) {
          setLiked(true);
          window.dispatchEvent(
            new Event("wishlist-updated")
          );
        }
      }
    } catch (error) {
      console.error("Wishlist error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await addToCart(product, 1);
    } catch (error) {
      console.error("Add to cart error:", error);
    }
  };

  return (
    <Link
      href={`/products/${slug}`}
      className={`card group flex h-full min-w-0 flex-col overflow-hidden ${isSearchVariant ? "" : "min-h-[410px]"
        }`}
    >
      {/* Product image */}
      <div
        className={`relative h-40 overflow-hidden sm:h-52 ${isSearchVariant
            ? "bg-[var(--color-surface-2)]"
            : "bg-zinc-100 dark:bg-zinc-800"
          }`}
      >
        {image ? (
          <Image
            src={image}
            alt={`${title} | فروشگاه برجک`}
            fill
            sizes={
              isSearchVariant
                ? "(max-width: 639px) 50vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            }
            className={`transition-all duration-500 group-hover:scale-105 ${isSearchVariant
                ? "object-contain p-3 sm:p-4"
                : "object-cover group-hover:scale-110"
              }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-[var(--color-text-muted)]">
            بدون تصویر
          </div>
        )}

        {hasDiscount && (
          <span className={`absolute right-2 top-2 rounded-full bg-[var(--color-accent)] font-medium text-white sm:right-3 sm:top-3 ${isSearchVariant
              ? "px-2 py-1 text-[10px] sm:text-xs"
              : "px-2 py-1 text-xs"
            }`}>
            {toPersianPrice(discount)}٪
          </span>
        )}
      </div>

      {/* Product information */}
      <div
        className={`flex min-w-0 flex-1 flex-col ${isSearchVariant
            ? "p-3 sm:p-5"
            : "p-5"
          }`}
      >
        {/* Title and wishlist */}
        <div
          className={`mb-3 flex min-w-0 items-start ${isSearchVariant
              ? "gap-2 sm:mb-4 sm:gap-3"
              : "mb-4 gap-3"
            }`}
        >
          <button
            type="button"
            onClick={toggleWishlist}
            disabled={loading}
            aria-label={
              liked
                ? "حذف از علاقه‌مندی‌ها"
                : "افزودن به علاقه‌مندی‌ها"
            }
            className={`mt-0.5 shrink-0 transition ${liked
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
              } ${loading
                ? "cursor-not-allowed opacity-60"
                : ""
              }`}
          >
            {liked ? (
              <BookmarkSolid
                className={
                  isSearchVariant
                    ? "h-4 w-4 sm:h-5 sm:w-5"
                    : "h-5 w-5"
                }
              />
            ) : (
              <BookmarkOutline
                className={
                  isSearchVariant
                    ? "h-4 w-4 sm:h-5 sm:w-5"
                    : "h-5 w-5"
                }
              />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <h3
              className={`break-words font-bold leading-6 [overflow-wrap:anywhere] ${isSearchVariant
                  ? "line-clamp-2 min-h-[44px] text-sm sm:text-[15px]"
                  : "line-clamp-2 min-h-[44px] text-[15px]"
                }`}
            >
              {title}
            </h3>
          </div>
        </div>

        {/* Brand, rating and stock */}
        <div
          className={`mt-2 flex min-w-0 flex-wrap items-center justify-between ${isSearchVariant
              ? "gap-x-2 gap-y-2 text-[10px] sm:text-xs"
              : "gap-2 text-xs"
            }`}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {brand?.title && (
              <span className="max-w-full truncate text-[var(--color-text-muted)]">
                {brand.title}
              </span>
            )}

            {rating != null && (
              <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[var(--color-text-muted)]">
                <span className="text-amber-500">★</span>
                {toPersianPrice(rating)}
                <span>
                  ({toPersianPrice(reviewCount ?? 0)})
                </span>
              </span>
            )}
          </div>

          <span
            className={`shrink-0 font-semibold ${stock > 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-500"
              }`}
          >
            {stock > 0 ? "موجود" : "ناموجود"}
          </span>
        </div>
      </div>

      {/* Price and cart button */}
      <div
        className={`mt-auto min-w-0 ${isSearchVariant
            ? "border-t border-[var(--color-border)] p-3 sm:p-5"
            : "p-5"
          }`}
      >
        <div className={`mb-2 ${isSearchVariant ? "min-h-4" : "h-5"}`}>
          {hasDiscount && (
            <span className={`flex flex-wrap items-center gap-1 text-[var(--color-text-muted)] ${isSearchVariant ? "text-[10px] sm:text-xs" : "text-xs"
              }`}>
              <span className="line-through">
                {toPersianPrice(originalPrice)}
              </span>
              <span>تومان</span>
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1">
          <span
            className={`font-black tracking-tight ${isSearchVariant
                ? "text-base sm:text-xl text-[var(--color-text)]"
                : "text-xl text-[var(--color-primary)] dark:text-[var(--color-accent)]"
              }`}
          >
            {toPersianPrice(price)}
          </span>

          <span
            className={`shrink-0 font-bold ${isSearchVariant
                ? "text-[10px] text-[var(--color-text-muted)] sm:text-sm"
                : "mr-1 text-base"
              }`}
          >
            تومان
          </span>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={stock <= 0}
          type="button"
          className={`mt-3 w-full ${stock > 0
              ? "btn-primary h-10 rounded-xl text-xs sm:h-11 sm:text-sm"
              : "cursor-not-allowed rounded-xl bg-gray-200 py-3 text-xs text-gray-400 dark:bg-zinc-800 dark:text-zinc-500 sm:text-sm"
            }`}
        >
          {stock > 0 ? "افزودن به سبد" : "ناموجود"}
        </button>
      </div>
    </Link>
  );
}
