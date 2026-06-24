"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../../context/AuthContext";
import { notFound, useParams, useRouter } from "next/navigation";
import BackButton from "../../../../components/BackButton";

const REVIEWS_LIMIT = 5;

export default function ProductPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const router = useRouter();

    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFoundFlag, setNotFoundFlag] = useState(false);

    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const [addError, setAddError] = useState("");
    const [showAllReviews, setShowAllReviews] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetch(`/api/products/${id}`)
            .then(async (res) => {
                if (!res.ok) {
                    if (active) setNotFoundFlag(true);
                    return null;
                }
                return res.json();
            })
            .then((data) => {
                if (active && data) setProduct(data);
            })
            .catch(() => {
                if (active) setNotFoundFlag(true);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [id]);

    if (notFoundFlag) notFound();

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center text-gray-400" dir="rtl">
                در حال بارگذاری...
            </div>
        );
    }

    if (!product) return null;

    const visibleReviews = showAllReviews ? product.reviews : product.reviews.slice(0, REVIEWS_LIMIT);

    const handleAddToCart = async () => {
        if (!user) { router.push("/login"); return; }

        setAddError("");
        setAdding(true);
        try {
            const res = await fetch("/api/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productId: product.id, quantity }),
            });

            const data = await res.json();

            if (!res.ok) {
                setAddError(data.error || "خطا در افزودن به سبد خرید");
                return;
            }

            // به Header/CartIcon خبر می‌دیم که سبد خرید عوض شده
            window.dispatchEvent(new Event("cart-updated"));

            setAdded(true);
            setTimeout(() => setAdded(false), 2000);
        } catch (error) {
            setAddError("خطا در ارتباط با سرور");
        } finally {
            setAdding(false);
        }
    };

    const stars = (rating) => [1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}>★</span>
    ));

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
            <BackButton />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-12">
                <div className="flex flex-col gap-3">
                    <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
                        <img
                            src={product.images[selectedImage]?.url || product.image}
                            alt={product.title}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    {product.images.length > 1 && (
                        <div className="flex gap-2">
                            {product.images.map((img, i) => (
                                <button key={img.id} onClick={() => setSelectedImage(i)}
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
                        <div className="flex text-lg">{stars(product.rating)}</div>
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
                    {product.specs && product.specs.length > 0 && (
                        <div className="border border-gray-100 rounded-2xl overflow-hidden">
                            {product.specs.map((spec, i) => (
                                <div key={spec.id} className={`flex justify-between px-4 py-3 text-sm ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                                    <span className="text-gray-500">{spec.key}</span>
                                    <span className="font-medium text-gray-800">{spec.value}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {addError && <p className="text-red-500 text-sm">{addError}</p>}

                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 text-lg hover:bg-gray-50 transition">−</button>
                            <span className="px-4 py-2 text-sm font-medium">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)} className="px-3 py-2 text-lg hover:bg-gray-50 transition">+</button>
                        </div>
                        <button onClick={handleAddToCart} disabled={!product.inStock || adding}
                            className={`flex-1 py-3 rounded-xl text-sm font-medium transition disabled:cursor-not-allowed ${
                                !product.inStock ? "bg-gray-200 text-gray-400"
                                : added ? "bg-green-500 text-white"
                                : "bg-black text-white hover:bg-gray-800 disabled:opacity-50"
                            }`}>
                            {!product.inStock ? "ناموجود" : adding ? "در حال افزودن..." : added ? "✓ افزوده شد" : "افزودن به سبد خرید"}
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-xl font-bold mb-6">نظرات کاربران ({product.reviews.length})</h2>
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
                                    <div className="flex text-sm">{stars(review.rating)}</div>
                                    <span className="text-xs text-gray-400">{review.date}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 leading-6">{review.comment}</p>
                        </div>
                    ))}
                </div>
                {product.reviews.length > REVIEWS_LIMIT && (
                    <button onClick={() => setShowAllReviews(s => !s)}
                        className="mt-4 w-full py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition">
                        {showAllReviews ? "نمایش کمتر ↑" : `نمایش همه ${product.reviews.length} نظر ↓`}
                    </button>
                )}
            </div>
        </div>
    );
}