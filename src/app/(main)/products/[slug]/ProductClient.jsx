"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import BackButton from "@/components/BackButton";
import { BookmarkIcon as BookmarkOutline } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolid } from "@heroicons/react/24/solid";
import Image from "next/image";
import Link from "next/link";
import RelatedProducts from "@/components/RelatedProducts";
import Breadcrumb from "@/components/Breadcrumb";
import { toPersianPrice } from "@/lib/utils";
import { useCart } from "@/context/CartContext";

const REVIEWS_LIMIT = 20;

const Stars = ({ rating, interactive = false, onRate }) => (
    <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
            <span
                key={i}
                onClick={() => interactive && onRate?.(i)}
                className={`text-lg ${interactive ? "cursor-pointer transition-transform hover:scale-110" : ""
                    } ${i <= Math.round(rating) ? "text-[var(--color-accent)]" : "text-[var(--color-border)]"}`}
            >
                ★
            </span>
        ))}
    </div>
);

export default function ProductPage({ product }) {
    const slug = product?.slug;

    const { user } = useAuth();
    const { addToCart } = useCart();

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
    const [imageLoaded, setImageLoaded] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === "Escape") {
                setLightboxOpen(false);
            }
        };

        window.addEventListener("keydown", handleKey);

        return () => window.removeEventListener("keydown", handleKey);
    }, []);

    useEffect(() => {
        if (!user || !product?.id) {
            setIsWishlisted(false);
            return;
        }

        const controller = new AbortController();

        const fetchWishlistStatus = async () => {
            try {
                const res = await fetch("/api/wishlist", {
                    signal: controller.signal,
                });

                if (!res.ok) return;

                const data = await res.json();
                const exists = data.some((item) => item.productId === product.id);
                setIsWishlisted(exists);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error(error);
                }
            }
        };

        fetchWishlistStatus();

        return () => controller.abort();
    }, [user, product?.id]);
    // disable scroll when modal open
    useEffect(() => {
        if (lightboxOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [lightboxOpen]);

    useEffect(() => {
        setImageLoaded(false);
    }, [selectedImage]);

    if (!product) return null;

    const approvedReviews = product.reviews?.filter((r) => r.approved) || [];
    const visibleReviews = showAllReviews
        ? approvedReviews
        : approvedReviews.slice(0, REVIEWS_LIMIT);

    const handleAddToCart = async () => {
        try {
            await addToCart(product, quantity);
            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
        } catch (err) {
            console.error(err);
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
            const res = await fetch(`/api/products/${slug}/reviews`, {
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

    const gallery =
        product.images?.length > 0
            ? product.images
            : [{ url: product.image }];

    const nextImage = () => {
        setSelectedImage((prev) => (prev + 1) % gallery.length);
    };

    const prevImage = () => {
        setSelectedImage((prev) =>
            prev === 0 ? gallery.length - 1 : prev - 1
        );
    };

    return (
        <>
            <div className="container-page py-10" dir="rtl">
                <BackButton />
                <Breadcrumb
                    items={[
                        ...(product.category?.title
                            ? [{
                                label: product.category.title,
                                ...(product.category.slug
                                    ? { href: `/category/${product.category.slug}` }
                                    : {}),
                            }]
                            : []),

                        ...(product.brand?.title
                            ? [{
                                label: product.brand.title,
                                ...(product.brand.slug
                                    ? { href: `/brand/${product.brand.slug}` }
                                    : {}),
                            }]
                            : []),

                        {
                            label: product.title,
                        },
                    ]}
                />
                <div className="mb-16 grid grid-cols-1 gap-14 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="flex flex-col gap-3">
                        <div className="card relative aspect-square overflow-hidden">
                            {!imageLoaded && (
                                <div className="absolute inset-0 animate-pulse bg-[var(--color-surface-2)]" />
                            )}
                            <div
                                onClick={() => setLightboxOpen(true)}
                                className="absolute inset-0 cursor-zoom-in"
                            >
                                <Image
                                    src={gallery[selectedImage].url}
                                    alt={product.title}
                                    fill
                                    priority={selectedImage === 0}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 40vw"
                                    onLoad={(e) => {
                                        if (e.target.complete) {
                                            setImageLoaded(true);
                                        }
                                    }}
                                    className={`
                                        object-cover hover:scale-105 transition-all duration-500
                                        ${imageLoaded ? "opacity-100" : "opacity-0"}
                                    `}
                                />
                            </div>
                            {gallery.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            prevImage();
                                        }}
                                        aria-label="تصویر قبلی"
                                        className="absolute right-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-md transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block h-5 w-5" aria-hidden="true">
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            nextImage();
                                        }}
                                        aria-label="تصویر بعدی"
                                        className="absolute left-4 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-md transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block h-5 w-5" aria-hidden="true">
                                            <path d="m15 18-6-6 6-6" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>

                        {gallery.length > 1 && (
                            <div className="flex justify-center gap-2 py-3">
                                {gallery.map((_, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImage(index)}
                                        className={`rounded-full transition-all ${selectedImage === index
                                            ? "h-2 w-8 bg-[var(--color-accent)]"
                                            : "h-2 w-2 bg-[var(--color-border)] hover:bg-[var(--color-text-muted)]"
                                            }`}
                                    />
                                ))}
                            </div>
                        )}

                        {gallery.length > 1 && (
                            <div className="flex flex-wrap gap-2">
                                {gallery.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedImage(i)}
                                        className={`relative h-20 w-20 overflow-hidden rounded-2xl transition
                    ${selectedImage === i
                                                ? "ring-2 ring-[var(--color-accent)]"
                                                : "border border-[var(--color-border)] hover:border-[var(--color-accent)]"
                                            }`}
                                    >
                                        <Image
                                            src={img.url}
                                            alt={product.title}
                                            fill
                                            sizes="80px"
                                            loading="eager"
                                            className="object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div>
                            <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-accent)]">
                                {product.category?.title}
                            </span>
                            <h1 className="mt-3 text-4xl font-bold leading-relaxed">
                                {product.title}
                            </h1>

                            {product.brand?.title && (
                                <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                                    برند:
                                    <span className="font-medium">
                                        {product.brand.title}
                                    </span>
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {product.category?.title && product.category?.slug && (
                                <Link
                                    href={`/category/${product.category.slug}`}
                                    className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-accent)] transition hover:opacity-80"
                                >
                                    {product.category.title}
                                </Link>
                            )}

                            {product.brand?.title && product.brand?.slug && (
                                <Link
                                    href={`/brand/${product.brand.slug}`}
                                    className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text)] transition hover:opacity-80"
                                >
                                    {product.brand.title}
                                </Link>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Stars rating={product.rating} />
                            <span className="text-sm text-[var(--color-text-muted)]">
                                {toPersianPrice(product.rating)} از ۵ ({toPersianPrice(product.reviewCount)} نظر)
                            </span>
                        </div>

                        <div className="card p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    {product.discount > 0 && (
                                        <div className="mb-1 flex items-center gap-2">
                                            <span className="rounded-lg bg-[var(--color-accent)] px-2 py-0.5 text-xs text-white">
                                                {toPersianPrice(product.discount)}% تخفیف
                                            </span>
                                            <span className="text-lg text-[var(--color-text-muted)] line-through">
                                                {toPersianPrice(product.originalPrice)} تومان
                                            </span>
                                        </div>
                                    )}

                                    <p className="text-2xl font-bold text-[var(--color-text)]">
                                        {toPersianPrice(product.price)} تومان
                                    </p>
                                </div>

                                <button
                                    onClick={handleToggleWishlist}
                                    disabled={wishlistLoading}
                                    aria-label={
                                        isWishlisted ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"
                                    }
                                    className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${isWishlisted
                                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
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

                        <p className="text-base leading-9 muted">{product.description}</p>
                        {product.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-2">

                                {product.tags.map((item) => (
                                    <Link
                                        key={item.tag.id}
                                        href={`/tag/${item.tag.slug}`}
                                        className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                    >
                                        #{item.tag.title}
                                    </Link>
                                ))}

                            </div>
                        )}

                        {product.specs?.length > 0 && (
                            <div className="card overflow-hidden p-0">
                                {product.specs.map((spec, i) => (
                                    <div
                                        key={i}
                                        className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0
                                            ? "bg-[var(--color-surface-2)]"
                                            : "bg-[var(--color-surface)]"
                                            }`}
                                    >
                                        <span className="text-[var(--color-text-muted)]">{spec.key}</span>
                                        <span className="font-medium text-[var(--color-text)]">{spec.value}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-2 flex items-center gap-3">
                            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                                <button
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="px-3 py-2 text-lg transition hover:bg-[var(--color-surface-2)]"
                                >
                                    −
                                </button>
                                <span className="px-4 py-2 text-sm font-medium text-[var(--color-text)]">{quantity}</span>
                                <button
                                    onClick={() => setQuantity((q) => q + 1)}
                                    className="px-3 py-2 text-lg transition hover:bg-[var(--color-surface-2)]"
                                >
                                    +
                                </button>
                            </div>

                            <button
                                onClick={handleAddToCart}
                                disabled={product.stock <= 0}
                                className={`flex-1 rounded-xl py-3 text-sm font-medium transition ${product.stock <= 0
                                    ? "cursor-not-allowed border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                                    : added
                                        ? "bg-green-500 text-white"
                                        : "btn-primary text-white"
                                    }`}
                            >
                                {product.stock <= 0
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
                        نظرات کاربران ({toPersianPrice(approvedReviews.length)})
                    </h2>

                    {user ? (
                        <div className="mb-6 card overflow-hidden border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                            <h3 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
                                نظر خودت رو بنویس
                            </h3>

                            {reviewMessage ? (
                                <div className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                                    {reviewMessage}
                                </div>
                            ) : (
                                <>
                                    <div className="mb-3">
                                        <p className="mb-1 text-xs text-[var(--color-text-muted)]">امتیاز</p>
                                        <Stars rating={reviewRating} interactive onRate={setReviewRating} />
                                    </div>

                                    <textarea
                                        value={reviewComment}
                                        onChange={(e) => setReviewComment(e.target.value)}
                                        placeholder="تجربه‌ات رو با دیگران به اشتراک بذار..."
                                        rows={3}
                                        className="mb-3 w-full resize-none rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-text)] bg-[var(--color-surface)] focus:border-[var(--color-accent)] focus:outline-none"
                                    />

                                    {reviewError && (
                                        <p className="mb-2 text-sm text-red-500">{reviewError}</p>
                                    )}

                                    <button
                                        onClick={handleReviewSubmit}
                                        disabled={reviewSubmitting}
                                        className="btn-primary rounded-xl px-6 py-3 text-sm font-medium disabled:opacity-50"
                                    >
                                        {reviewSubmitting ? "در حال ارسال..." : "ثبت نظر"}
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="mb-6 rounded-2xl bg-[var(--color-surface-2)] p-4 text-center text-sm text-[var(--color-text-muted)]">
                            برای ثبت نظر{" "}
                            <a href="/login" className="font-bold text-[var(--color-accent)] underline">
                                وارد شو
                            </a>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        {visibleReviews.map((review) => (
                            <div
                                key={review.id}
                                className="card p-5"
                            >
                                <div className="mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface-2)] text-sm font-bold text-[var(--color-text-muted)]">
                                            {(review.author?.name || review.user).charAt(0)}
                                        </div>
                                        <span className="text-sm font-medium">{review.author?.name || review.user}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Stars rating={review.rating} />
                                        <span className="text-xs text-[var(--color-text-muted)]">{review.date}</span>
                                    </div>
                                </div>

                                <p className="text-sm leading-6 text-[var(--color-text-muted)]">{review.comment}</p>
                            </div>
                        ))}

                        {approvedReviews.length === 0 && (
                            <p className="muted py-8 text-center text-sm">
                                هنوز نظری ثبت نشده
                            </p>
                        )}
                    </div>

                    {approvedReviews.length > REVIEWS_LIMIT && (
                        <button
                            onClick={() => setShowAllReviews((s) => !s)}
                            className="mt-6 w-full rounded-xl border border-[var(--color-border)] py-3 text-[var(--color-accent)] transition hover:bg-[var(--color-surface-2)]"
                        >
                            {showAllReviews
                                ? "نمایش کمتر ↑"
                                : `نمایش همه ${approvedReviews.length} نظر ↓`}
                        </button>
                    )}
                </div>
                <RelatedProducts products={product.relatedProducts || []} />
                {lightboxOpen && (
                    <div
                        className="fixed inset-0 z-9999 bg-black/90 flex items-center justify-center"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <div
                            className="relative w-full h-full max-w-7xl max-h-screen flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >

                            <button
                                onClick={() => setLightboxOpen(false)}
                                className="absolute left-6 top-6 z-20 text-3xl text-white transition hover:text-[var(--color-accent)]"
                            >
                                ✕
                            </button>

                            {gallery.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={prevImage}
                                        aria-label="تصویر قبلی"
                                        className="absolute right-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 p-0 text-white shadow-lg backdrop-blur-sm transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:right-6"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block h-6 w-6 shrink-0" aria-hidden="true">
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={nextImage}
                                        aria-label="تصویر بعدی"
                                        className="absolute left-4 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 p-0 text-white shadow-lg backdrop-blur-sm transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] sm:left-6"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block h-6 w-6 shrink-0" aria-hidden="true">
                                            <path d="m15 18-6-6 6-6" />
                                        </svg>
                                    </button>
                                </>
                            )}
                            <div className="relative w-[90vw] h-[80vh]">
                                <Image
                                    src={gallery[selectedImage].url}
                                    alt={product.title}
                                    fill
                                    className="object-contain"
                                    sizes="100vw"
                                />
                            </div>
                            <div className="absolute bottom-6 flex gap-3 overflow-x-auto px-4">
                                {gallery.map((img, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setSelectedImage(index)}
                                        className={`relative h-20 w-20 overflow-hidden rounded-xl border-2 transition
                                            ${selectedImage === index
                                                ? "border-[var(--color-accent)]"
                                                : "border-white/20"
                                            }`}
                                    >
                                        <Image
                                            src={img.url}
                                            alt=""
                                            fill
                                            sizes="80px"
                                            className="object-cover"
                                        />
                                    </button>
                                ))}
                            </div>

                        </div>
                    </div>
                )}
            </div>
        </>
    );

}