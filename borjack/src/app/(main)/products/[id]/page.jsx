"use client";

import { useState, useEffect, use } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { useRouter } from "next/navigation";
import BackButton from "../../../../components/BackButton";

const REVIEWS_LIMIT = 20;

const Stars = ({ rating, interactive = false, onRate }) => (
    <div className="flex">
        {[1,2,3,4,5].map(i => (
            <span key={i}
                onClick={() => interactive && onRate?.(i)}
                className={`text-lg ${interactive ? "cursor-pointer hover:scale-110 transition-transform" : ""} ${i <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`}>
                ★
            </span>
        ))}
    </div>
);

export default function ProductPage({ params }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [added, setAdded] = useState(false);
    const [showAllReviews, setShowAllReviews] = useState(false);

    // فرم نظر
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [reviewMessage, setReviewMessage] = useState("");
    const [reviewError, setReviewError] = useState("");

    useEffect(() => {
        fetch(`/api/products/${id}`)
            .then(res => { if (!res.ok) throw new Error(); return res.json(); })
            .then(data => setProduct(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-400">در حال بارگذاری...</div>;
    if (!product) return null;

    // فقط نظرات تایید شده نمایش داده میشه
    const approvedReviews = product.reviews?.filter(r => r.approved) || [];
    const visibleReviews = showAllReviews ? approvedReviews : approvedReviews.slice(0, REVIEWS_LIMIT);

    const handleAddToCart = async () => {
        if (!user) { window.location.href = "/login"; return; }
        const res = await fetch("/api/cart", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId: product.id, quantity }),
        });
        if (res.ok) {
            setAdded(true);
            // ۲. آپدیت لحظه‌ای آیکون سبد خرید
            window.dispatchEvent(new Event("cart-updated"));
            setTimeout(() => setAdded(false), 2000);
        }
    };

    const handleReviewSubmit = async () => {
        setReviewError("");
        if (reviewRating === 0) { setReviewError("لطفاً امتیاز بده"); return; }
        if (!reviewComment.trim()) { setReviewError("نظرت رو بنویس"); return; }

        setReviewSubmitting(true);
        try {
            const res = await fetch(`/api/products/${id}/reviews`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating: reviewRating, comment: reviewComment }),
            });
            const data = await res.json();
            if (!res.ok) { setReviewError(data.error); return; }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
            <BackButton />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
                <div className="flex flex-col gap-3">
                    <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
                        <img src={product.images?.[selectedImage]?.url || product.image} alt={product.title} className="w-full h-full object-cover" />
                    </div>
                    {product.images?.length > 1 && (
                        <div className="flex gap-2">
                            {product.images.map((img, i) => (
                                <button key={i} onClick={() => setSelectedImage(i)}
                                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition ${selectedImage === i ? "border-black" : "border-transparent"}`}>
                                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4">
                    <div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{product.category}</span>
                        <h1 className="text-2xl font-bold text-gray-900 mt-3">{product.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Stars rating={product.rating} />
                        <span className="text-sm text-gray-500">{product.rating} از ۵ ({product.reviewCount} نظر)</span>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4">
                        {product.discount > 0 && (
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-black text-white text-xs px-2 py-0.5 rounded-lg">{product.discount}% تخفیف</span>
                                <span className="text-sm text-gray-400 line-through">{product.originalPrice.toLocaleString()} تومان</span>
                            </div>
                        )}
                        <p className="text-2xl font-bold text-gray-900">{product.price.toLocaleString()} تومان</p>
                    </div>
                    <p className="text-sm text-gray-600 leading-7">{product.description}</p>

                    {product.specs?.length > 0 && (
                        <div className="border border-gray-100 rounded-2xl overflow-hidden">
                            {product.specs.map((spec, i) => (
                                <div key={i} className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                                    <span className="text-gray-500">{spec.key}</span>
                                    <span className="font-medium text-gray-800">{spec.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 text-lg hover:bg-gray-50 transition">−</button>
                            <span className="px-4 py-2 text-sm font-medium">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2 text-lg hover:bg-gray-50 transition">+</button>
                        </div>
                        <button onClick={handleAddToCart} disabled={!product.inStock}
                            className={`flex-1 py-3 rounded-xl text-sm font-medium transition ${!product.inStock ? "bg-gray-200 text-gray-400 cursor-not-allowed" : added ? "bg-green-500 text-white" : "bg-black text-white hover:bg-gray-800"}`}>
                            {!product.inStock ? "ناموجود" : added ? "✓ افزوده شد" : "افزودن به سبد خرید"}
                        </button>
                    </div>
                </div>
            </div>

            {/* نظرات */}
            <div>
                <h2 className="text-xl font-bold mb-6">نظرات کاربران ({approvedReviews.length})</h2>

                {/* فرم ثبت نظر */}
                {user ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-4">نظر خودت رو بنویس</h3>
                        {reviewMessage ? (
                            <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3 text-sm">
                                {reviewMessage}
                            </div>
                        ) : (
                            <>
                                <div className="mb-3">
                                    <p className="text-xs text-gray-500 mb-1">امتیاز</p>
                                    <Stars rating={reviewRating} interactive onRate={setReviewRating} />
                                </div>
                                <textarea
                                    value={reviewComment}
                                    onChange={e => setReviewComment(e.target.value)}
                                    placeholder="تجربه‌ات رو با دیگران به اشتراک بذار..."
                                    rows={3}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 resize-none mb-3"
                                />
                                {reviewError && <p className="text-red-500 text-sm mb-2">{reviewError}</p>}
                                <button onClick={handleReviewSubmit} disabled={reviewSubmitting}
                                    className="px-5 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition disabled:opacity-50">
                                    {reviewSubmitting ? "در حال ارسال..." : "ثبت نظر"}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-sm text-gray-500 text-center">
                        برای ثبت نظر <a href="/login" className="text-black underline">وارد شو</a>
                    </div>
                )}

                {/* لیست نظرات */}
                <div className="flex flex-col gap-4">
                    {visibleReviews.map(review => (
                        <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                                        {review.user[0]}
                                    </div>
                                    <span className="text-sm font-medium">{review.user}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Stars rating={review.rating} />
                                    <span className="text-xs text-gray-400">{review.date}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 leading-6">{review.comment}</p>
                        </div>
                    ))}
                    {approvedReviews.length === 0 && (
                        <p className="text-center text-gray-400 py-8 text-sm">هنوز نظری ثبت نشده</p>
                    )}
                </div>

                {approvedReviews.length > REVIEWS_LIMIT && (
                    <button onClick={() => setShowAllReviews(s => !s)}
                        className="mt-4 w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                        {showAllReviews ? "نمایش کمتر ↑" : `نمایش همه ${approvedReviews.length} نظر ↓`}
                    </button>
                )}
            </div>
        </div>
    );
}