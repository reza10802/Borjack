"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "../../../components/BackButton";

export default function CartPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [cart, setCart] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderError, setOrderError] = useState("");

    useEffect(() => {
        if (loading) return;
        if (!user) { router.push("/login"); return; }
        fetchCart();
    }, [user, loading]);

    const fetchCart = async () => {
        try {
            const res = await fetch("/api/cart");
            if (!res.ok) return;
            const data = await res.json();
            setCart(data);
        } catch (error) {
            console.error(error);
        } finally {
            setFetching(false);
        }
    };

    const changeQty = async (productId, quantity) => {
        if (quantity < 1) return removeItem(productId);
        const res = await fetch(`/api/cart/${productId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quantity }),
        });
        if (res.ok) {
            setCart(cart.map(item =>
                item.productId === productId ? { ...item, quantity } : item
            ));
            window.dispatchEvent(new Event("cart-updated"));
        }
    };

    const removeItem = async (productId) => {
        const res = await fetch(`/api/cart/${productId}`, { method: "DELETE" });
        if (res.ok) {
            setCart(cart.filter(item => item.productId !== productId));
            window.dispatchEvent(new Event("cart-updated"));
        }
    };

    const clearCart = async () => {
        const res = await fetch("/api/cart", { method: "DELETE" });
        if (res.ok) {
            setCart([]);
            window.dispatchEvent(new Event("cart-updated"));
        }
    };

    const handleCheckout = async () => {
        setOrderError("");
        setPlacingOrder(true);
        try {
            const res = await fetch("/api/orders", { method: "POST" });
            const data = await res.json();

            if (!res.ok) {
                setOrderError(data.error || "خطا در ثبت سفارش");
                return;
            }

            setCart([]);
            window.dispatchEvent(new Event("cart-updated"));
            router.push(`/profile?order=${data.id}`);
        } catch (error) {
            setOrderError("خطا در ارتباط با سرور");
        } finally {
            setPlacingOrder(false);
        }
    };

    const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    if (loading || fetching) return (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400">
            در حال بارگذاری...
        </div>
    );

    if (cart.length === 0) return (
        <div className="max-w-2xl mx-auto px-4 py-20 text-center" dir="rtl">
            <p className="text-5xl mb-4">🛒</p>
            <h2 className="text-xl font-bold text-gray-800 mb-2">سبد خرید خالی است</h2>
            <p className="text-sm text-gray-500 mb-6">محصولی به سبد خرید اضافه نکردی</p>
            <Link href="/" className="inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition">
                بازگشت به فروشگاه
            </Link>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
            <BackButton />
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">سبد خرید</h1>
                <button onClick={clearCart} className="text-sm text-gray-400 hover:text-red-500 transition">
                    پاک کردن همه
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {cart.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4">
                            <Link href={`/products/${item.productId}`} className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                <img
                                    src={item.product.images?.[0]?.url || item.product.image}
                                    alt={item.product.title}
                                    className="w-full h-full object-cover"
                                    onError={e => e.target.style.display = "none"}
                                />
                            </Link>

                            <div className="flex-1 flex flex-col justify-between">
                                <div className="flex items-start justify-between gap-2">
                                    <Link href={`/products/${item.productId}`}
                                        className="text-sm font-medium text-gray-800 hover:text-black line-clamp-2">
                                        {item.product.title}
                                    </Link>
                                    <button onClick={() => removeItem(item.productId)}
                                        className="text-gray-300 hover:text-red-500 transition shrink-0 text-lg leading-none">
                                        ✕
                                    </button>
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                                        <button onClick={() => changeQty(item.productId, item.quantity - 1)}
                                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition text-lg">−</button>
                                        <span className="px-3 py-1.5 text-sm font-medium">{item.quantity}</span>
                                        <button onClick={() => changeQty(item.productId, item.quantity + 1)}
                                            className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition text-lg">+</button>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-gray-900">
                                            {(item.product.price * item.quantity).toLocaleString()} تومان
                                        </p>
                                        {item.quantity > 1 && (
                                            <p className="text-xs text-gray-400">{item.product.price.toLocaleString()} × {item.quantity}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24">
                        <h2 className="text-lg font-bold mb-4">خلاصه سفارش</h2>
                        <div className="flex flex-col gap-3 mb-4">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>تعداد کالا</span>
                                <span>{totalItems} عدد</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>هزینه ارسال</span>
                                <span className="text-green-600">رایگان</span>
                            </div>
                            <div className="border-t border-gray-100 pt-3 flex justify-between font-bold">
                                <span>جمع کل</span>
                                <span>{total.toLocaleString()} تومان</span>
                            </div>
                        </div>

                        {orderError && (
                            <p className="text-red-500 text-xs text-center mb-3">{orderError}</p>
                        )}

                        <button
                            onClick={handleCheckout}
                            disabled={placingOrder}
                            className="w-full bg-black text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {placingOrder ? "در حال ثبت سفارش..." : "ادامه و پرداخت"}
                        </button>

                        <Link href="/" className="block text-center text-sm text-gray-500 hover:text-black transition mt-3">
                            ادامه خرید
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}