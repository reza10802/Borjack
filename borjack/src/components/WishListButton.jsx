"use client";

import { useEffect, useState } from "react";

export default function WishlistButton({ productId, className = "" }) {
  const [loading, setLoading] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function fetchWishlistState() {
      try {
        const res = await fetch("/api/wishlist");
        if (!res.ok) return;

        const data = await res.json();
        const exists = data.some((item) => item.productId === productId);

        if (!ignore) setLiked(exists);
      } catch (error) {
        console.error(error);
      }
    }

    fetchWishlistState();

    return () => {
      ignore = true;
    };
  }, [productId]);

  const toggleWishlist = async () => {
    if (loading) return;

    setLoading(true);
    try {
      if (liked) {
        const res = await fetch(`/api/wishlist/${productId}`, {
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
          body: JSON.stringify({ productId }),
        });

        if (res.ok) {
          setLiked(true);
          window.dispatchEvent(new Event("wishlist-updated"));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      disabled={loading}
      aria-label={liked ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      className={`w-11 h-11 rounded-xl border flex items-center justify-center transition ${
        liked
          ? "border-red-200 bg-red-50 text-red-500"
          : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
      } ${className}`}
    >
      <span className="text-xl leading-none">
        {liked ? "♥" : "♡"}
      </span>
    </button>
  );
}