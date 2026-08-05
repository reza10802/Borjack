"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { useCart } from "@/context/CartContext";

export default function CartPage() {
  const { cartItems, updateQuantity, removeItem, clearCart, loading: cartLoading } = useCart();
  const { user, loading } = useAuth();
  const router = useRouter();

  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");

  const handleCheckout = () => {
    if (!user) {
      router.push("/login?redirect=/checkout");
      return;
    }

    router.push("/checkout");
  };

  const total = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading || cartLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400">
        در حال بارگذاری...
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-12 text-center" dir="rtl">
        <p className="text-5xl mb-4">🛒</p>
        <h2 className="text-xl font-black text-[var(--color-primary)] dark:text-white">
          سبد خرید خالی است
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          محصولی به سبد خرید اضافه نکردی
        </p>
        <Link
          href="/"
          className="inline-block bg-black text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
        >
          بازگشت به فروشگاه
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8" dir="rtl">
      <BackButton />

      <div className="flex items-center justify-between mb-6 gap-3">
        <h1 className="text-2xl font-bold">سبد خرید</h1>
        <button
          onClick={clearCart}
          className="text-sm text-gray-400 hover:text-red-500 transition"
        >
          پاک کردن همه
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {cartItems.map((item) => (
            <div
              key={item.id}
              className="card flex gap-4 p-5 transition hover:-translate-y-0.5"
            >
              <Link
                href={`/products/${item.productId}`}
                className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0"
              >
                <img
                  src={item.product.images?.[0]?.url || item.product.image}
                  alt={item.product.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </Link>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${item.productId}`}
                    className="line-clamp-2 text-sm font-bold text-[var(--color-primary)] dark:text-white hover:text-[var(--color-accent)] transition"
                  >
                    {item.product.title}
                  </Link>

                  <button
                    onClick={() => removeItem(item.productId)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex items-center justify-between mt-3 gap-3">
                  <div className="flex items-center rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity - 1)
                      }
                      className="h-10 w-10 flex items-center justify-center text-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      −
                    </button>

                    <span className="w-10 text-center font-bold text-zinc-800 dark:text-white">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() =>
                        updateQuantity(item.productId, item.quantity + 1)
                      }
                      className="h-10 w-10 flex items-center justify-center text-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-left shrink-0">
                    <p className="text-lg font-black text-[var(--color-primary)] dark:text-[var(--color-accent)]">
                      {(item.product.price * item.quantity).toLocaleString("fa-IR")}{" "}
                      تومان
                    </p>

                    {item.quantity > 1 && (
                      <p className="text-xs text-gray-400">
                        {item.product.price.toLocaleString("fa-IR")} ×{" "}
                        {item.quantity}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          <div className="card sticky top-24 p-6">
            <h2 className="text-lg font-bold mb-4">خلاصه سفارش</h2>

            <div className="flex flex-col gap-3 mb-4">
              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
                <span>تعداد کالا</span>
                <span>{totalItems} عدد</span>
              </div>

              <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-300">
                <span>هزینه ارسال</span>
                <span className="text-green-600">رایگان</span>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-2xl bg-zinc-50 dark:bg-zinc-800 p-4 font-bold">
                <span>جمع کل</span>
                <span>{total.toLocaleString("fa-IR")} تومان</span>
              </div>
            </div>

            {orderError && (
              <p className="text-red-500 text-xs text-center mb-3">
                {orderError}
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={placingOrder}
              className="btn-primary h-12 w-full rounded-2xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {placingOrder ? "در حال انتقال..." : "ادامه و پرداخت"}
            </button>

            <Link
              href="/"
              className="mt-4 block text-center text-sm font-semibold text-[var(--color-accent)] hover:underline"
            >
              ادامه خرید
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}