"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, use } from "react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/BackButton";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";

const REVIEWS_LIMIT = 20;

const Stars = ({ rating, interactive = false, onRate }) => (
  <div className="flex">
    {[1, 2, 3, 4, 5].map((i) => (
      <span
        key={i}
        onClick={() => interactive && onRate?.(i)}
        className={`text-lg ${interactive ? "cursor-pointer transition-transform hover:scale-110" : ""
          } ${i <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`}
      >
        ★
      </span>
    ))}
  </div>
);

export default function ProductPage({ params }) {
  const { id } = use(params);
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const [showAllReviews, setShowAllReviews] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");

  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const res = await fetch(`/api/products/${id}`);
        if (!res.ok) throw new Error("failed");
        const data = await res.json();
        setProduct(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!user || !product?.id) {
      setIsWishlisted(false);
      return;
    }

    const fetchWishlistStatus = async () => {
      try {
        const res = await fetch("/api/wishlist");
        if (!res.ok) return;

        const data = await res.json();
        const exists = data.some((item) => item.productId === product.id);
        setIsWishlisted(exists);
      } catch (error) {
        console.error(error);
      }
    };

    fetchWishlistStatus();
  }, [user, product?.id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center text-gray-400">
        در حال بارگذاری...
      </div>
    );
  }

  if (!product) return null;

  const approvedReviews = product.reviews?.filter((r) => r.approved) || [];
  const visibleReviews = showAllReviews
    ? approvedReviews
    : approvedReviews.slice(0, REVIEWS_LIMIT);

  const handleAddToCart = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const res = await fetch("/api/cart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: product.id,
        quantity,
      }),
    });

    if (res.ok) {
      setAdded(true);
      window.dispatchEvent(new Event("cart-updated"));
      setTimeout(() => setAdded(false), 2000);
    }
  };

  const handleToggleWishlist = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (wishlistLoading) return;
    setWishlistLoading(true);

    try {
      if (isWishlisted) {
        const res = await fetch(`/api/wishlist/${product.id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          setIsWishlisted(false);
          window.dispatchEvent(new Event("wishlist-updated"));
        }
      } else {
        const res = await fetch("/api/wishlist", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            productId: product.id,
          }),
        });

        if (res.ok) {
          setIsWishlisted(true);
          window.dispatchEvent(new Event("wishlist-updated"));
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleReviewSubmit = async () => {
    setReviewError("");

    if (reviewRating === 0) {
      setReviewError("لطفاً امتیاز بده");
      return;
    }

    if (!reviewComment.trim()) {
      setReviewError("نظرت رو بنویس");
      return;
    }

    setReviewSubmitting(true);

    try {
      const res = await fetch(`/api/products/${id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setReviewError(data.error || "خطا در ثبت نظر");
        return;
      }

      setReviewMessage(data.message);
      setReviewRating(0);
      setReviewComment("");
    } catch {
      setReviewError("خطا در ارسال نظر");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" dir="rtl">
      <BackButton />

      <div className="mb-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="aspect-square overflow-hidden rounded-2xl bg-gray-100">
            <img
              src={product.images?.[selectedImage]?.url || product.image}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          </div>

          {product.images?.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`h-16 w-16 overflow-hidden rounded-xl border-2 transition ${selectedImage === i ? "border-black" : "border-transparent"
                    }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-400">
              {product.category}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">
              {product.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <Stars rating={product.rating} />
            <span className="text-sm text-gray-500">
              {product.rating} از ۵ ({product.reviewCount} نظر)
            </span>
          </div>

          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                {product.discount > 0 && (
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-lg bg-black px-2 py-0.5 text-xs text-white">
                      {product.discount}% تخفیف
                    </span>
                    <span className="text-sm text-gray-400 line-through">
                      {product.originalPrice.toLocaleString()} تومان
                    </span>
                  </div>
                )}

                <p className="text-2xl font-bold text-gray-900">
                  {product.price.toLocaleString()} تومان
                </p>
              </div>

              <button
                onClick={handleToggleWishlist}
                disabled={wishlistLoading}
                aria-label={
                  isWishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
                }
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${isWishlisted
                  ? "border-black bg-black text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-black"
                  } ${wishlistLoading ? "cursor-not-allowed opacity-60" : ""}`}
              >
                {isWishlisted ? (
                  <BookmarkSolid className="h-5 w-5" />
                ) : (
                  <BookmarkOutline className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <p className="text-sm leading-7 text-gray-600">{product.description}</p>

          {product.specs?.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-gray-100">
              {product.specs.map((spec, i) => (
                <div
                  key={i}
                  className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? "bg-gray-50" : "bg-white"
                    }`}
                >
                  <span className="text-gray-500">{spec.key}</span>
                  <span className="font-medium text-gray-800">{spec.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center overflow-hidden rounded-xl border border-gray-200">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-lg transition hover:bg-gray-50"
              >
                −
              </button>
              <span className="px-4 py-2 text-sm font-medium">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-2 text-lg transition hover:bg-gray-50"
              >
                +
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!product.inStock}
              className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${!product.inStock
                ? "cursor-not-allowed bg-gray-200 text-gray-400"
                : added
                  ? "bg-green-500 text-white"
                  : "bg-black text-white hover:bg-gray-800"
                }`}
            >
              {!product.inStock
                ? "ناموجود"
                : added
                  ? "✓ افزوده شد"
                  : "افزودن به سبد خرید"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-6 text-xl font-bold">
          نظرات کاربران ({approvedReviews.length})
        </h2>

        {user ? (
          <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-700">
              نظر خودت رو بنویس
            </h3>

            {reviewMessage ? (
              <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
                {reviewMessage}
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <p className="mb-1 text-xs text-gray-500">امتیاز</p>
                  <Stars rating={reviewRating} interactive onRate={setReviewRating} />
                </div>

                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="تجربه‌ات رو با دیگران به اشتراک بذار..."
                  rows={3}
                  className="mb-3 w-full resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-gray-400 focus:outline-none"
                />

                {reviewError && (
                  <p className="mb-2 text-sm text-red-500">{reviewError}</p>
                )}

                <button
                  onClick={handleReviewSubmit}
                  disabled={reviewSubmitting}
                  className="rounded-xl bg-black px-5 py-2 text-sm text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {reviewSubmitting ? "در حال ارسال..." : "ثبت نظر"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="mb-6 rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-500">
            برای ثبت نظر{" "}
            <a href="/login" className="text-black underline">
              وارد شو
            </a>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {visibleReviews.map((review) => (
            <div
              key={review.id}
              className="rounded-2xl border border-gray-100 bg-white p-5"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                    {review.user?.[0]}
                  </div>
                  <span className="text-sm font-medium">{review.user}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Stars rating={review.rating} />
                  <span className="text-xs text-gray-400">{review.date}</span>
                </div>
              </div>

              <p className="text-sm leading-6 text-gray-600">{review.comment}</p>
            </div>
          ))}

          {approvedReviews.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              هنوز نظری ثبت نشده
            </p>
          )}
        </div>

        {approvedReviews.length > REVIEWS_LIMIT && (
          <button
            onClick={() => setShowAllReviews((s) => !s)}
            className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            {showAllReviews
              ? "نمایش کمتر ↑"
              : `نمایش همه ${approvedReviews.length} نظر ↓`}
          </button>
        )}
      </div>
    </div>
  );
}