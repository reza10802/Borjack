"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import Image from "next/image";
import { toPersianPrice } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

export default function ProductCard({ product }) {
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

  const [liked, setLiked] = useState(isWishlisted);
  const [loading, setLoading] = useState(false);

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
          window.dispatchEvent(new Event("wishlist-updated"));
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: id }),
        });

        if (res.ok) {
          setLiked(true);
          window.dispatchEvent(new Event("wishlist-updated"));
        }
      }
    } catch (error) {
      console.error("Wishlist error:", error);
    } finally {
      setLoading(false);
    }
  };
  const { addToCart } = useCart();
  // ...
  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await addToCart(product, 1);
    } catch (err) {
      console.error(err);
    }
  };
  return (
    <Link
      href={`/products/${slug}`}
      className="card group flex h-full min-h-[410px] flex-col overflow-hidden"
    >
      <div className="relative h-52 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {image ? (
          <Image
            src={image}
            alt={`${title} | فروشگاه برجک`}
            fill
            sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 25vw"
            className="object-cover transition-all duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            بدون تصویر
          </div>
        )}

        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-[var(--color-accent)] px-2 py-1 text-xs font-medium text-white">
            {toPersianPrice(discount)}%
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* عنوان + بوکمارک */}
        <div className="mb-4 flex items-start gap-3">
          <button
            type="button"
            onClick={toggleWishlist}
            disabled={loading}
            aria-label={liked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            className={`mt-0.5 shrink-0 transition ${liked
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-accent)] hover:opacity-80"
              } ${loading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {liked ? (
              <BookmarkSolid className="h-5 w-5" />
            ) : (
              <BookmarkOutline className="h-5 w-5" />
            )}
          </button>

          <div className="flex-1">
            <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-bold leading-6">
              {title}
            </h3>
          </div>
        </div>

        <div className="mt-2 space-y-1 flex justify-between items-center">

          <div className="flex items-center justify-between text-xs">

            <span className="text-zinc-500">
              {brand?.title}
            </span>

            <span className="flex items-center gap-1">

              ⭐

              {rating}

              ({reviewCount})

            </span>

          </div>

          <div className="text-xs font-semibold text-green-600">
            {stock > 0 ? "موجود" : "ناموجود"}
          </div>

        </div>

      </div>
      {/* قیمت */}
      <div className="mt-auto p-5">
        <div className="h-5">
          {discount > 0 && originalPrice ? (
            <span className="block text-xs text-zinc-400 line-through">
              {toPersianPrice(originalPrice)} تومان
            </span>
          ) : null}
        </div>

        <p className="text-xl font-black text-[var(--color-primary)] dark:text-[var(--color-accent)]">

          {toPersianPrice(price)}

          <span className="mr-1 text-base font-bold">
            تومان
          </span>

        </p>
        <div className="mt-3" />
        <button
          onClick={handleAddToCart}
          disabled={stock <= 0}
          type="button"
          className={`mt-auto w-full ${stock > 0
            ? "btn-primary h-11 w-full rounded-xl text-sm"
            : "rounded-xl bg-gray-200 py-3 text-gray-400 cursor-not-allowed"
            }`}
        >
          {stock > 0 ? "افزودن به سبد" : "ناموجود"}
        </button>
      </div>
    </Link >

  );
}