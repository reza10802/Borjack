"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";

export default function ProductCard({ product }) {
  const {
    id,
    title,
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

  return (
    <div className="group flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-lg">
      <Link href={`/products/${id}`} className="block">
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              بدون تصویر
            </div>
          )}

          {discount > 0 && (
            <span className="absolute right-3 top-3 rounded-lg bg-black px-2 py-1 text-xs font-medium text-white">
              {discount}%
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        {/* عنوان + بوکمارک */}
        <div className="mb-3 flex items-start gap-2">
          <button
            onClick={toggleWishlist}
            disabled={loading}
            aria-label={liked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            className={`mt-0.5 shrink-0 transition ${
              liked ? "text-black" : "text-gray-400 hover:text-black"
            } ${loading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {liked ? (
              <BookmarkSolid className="h-5 w-5" />
            ) : (
              <BookmarkOutline className="h-5 w-5" />
            )}
          </button>

          <Link href={`/products/${id}`} className="flex-1 min-w-0">
            <h3 className="line-clamp-2 min-h-[56px] text-sm font-medium leading-7 text-gray-800">
              {title}
            </h3>
          </Link>
        </div>

        {/* امتیاز */}
        <div className="mb-3 flex h-6 items-center justify-end gap-1 text-sm">
          <span className="text-gray-500">({reviewCount})</span>
          <span className="text-gray-600">{rating}</span>
          <span className="text-yellow-400">★</span>
        </div>

        {/* قیمت */}
        <div className="mt-auto">
          <div className="mb-1 h-6">
            {discount > 0 && originalPrice ? (
              <span className="block text-sm text-gray-400 line-through">
                {originalPrice.toLocaleString()} تومان
              </span>
            ) : null}
          </div>

          <p className="text-xl font-bold text-gray-900">
            {price.toLocaleString()} تومان
          </p>
        </div>
      </div>
    </div>
  );
}