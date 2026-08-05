"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/orderStatus";
import { toPersianPrice } from "@/lib/utils";

function ProfileContent() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightedOrderId = searchParams.get("order");

    const [orders, setOrders] = useState([]);
    const [orderTab, setOrderTab] = useState("paid");

    const paidOrders = orders.filter(
        (o) => o.paymentStatus === "PAID"
    );

    const pendingOrders = orders.filter(
        (o) => o.paymentStatus === "PENDING"
    );

    const [wishlist, setWishlist] = useState([]);

    const [ordersLoading, setOrdersLoading] = useState(true);
    const [wishlistLoading, setWishlistLoading] = useState(true);

    const [activeTab, setActiveTab] = useState(
        highlightedOrderId ? "orders" : "account"
    );

    const [isEditing, setIsEditing] = useState(false);

    const [accountForm, setAccountForm] = useState({
        name: "",
        address: "",
        postalCode: "",
    });

    const [savingAccount, setSavingAccount] = useState(false);
    const [accountMessage, setAccountMessage] = useState("");

    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        setAccountForm({
            name: user.name || "",
        });

        fetchOrders();
        fetchWishlist();
    }, [user, loading]);

    useEffect(() => {
        const refetchWishlist = () => {
            if (user) fetchWishlist();
        };

        window.addEventListener("wishlist-updated", refetchWishlist);
        return () => {
            window.removeEventListener("wishlist-updated", refetchWishlist);
        };
    }, [user]);

    const fetchOrders = async () => {
        try {
            setOrdersLoading(true);

            const res = await fetch("/api/order", {
                cache: "no-store",
            });

            if (!res.ok) {
                setOrders([]);
                return;
            }

            const data = await res.json();

            setOrders(data || []);
        } catch (error) {
            console.error(error);
            setOrders([]);
        } finally {
            setOrdersLoading(false);
        }
    };

    const fetchWishlist = async () => {
        try {
            setWishlistLoading(true);

            const res = await fetch("/api/wishlist", {
                cache: "no-store",
            });

            if (!res.ok) {
                setWishlist([]);
                return;
            }

            const data = await res.json();
            setWishlist(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setWishlist([]);
        } finally {
            setWishlistLoading(false);
        }
    };

    const removeFromWishlist = async (productId) => {
        try {
            const res = await fetch(`/api/wishlist/${productId}`, {
                method: "DELETE",
            });

            if (!res.ok) return;

            setWishlist((prev) =>
                prev.filter((item) => item.productId !== productId)
            );

            window.dispatchEvent(new Event("wishlist-updated"));
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveAccount = async () => {
        const name = accountForm.name.trim();
        const address = accountForm.address.trim();
        const postalCode = accountForm.postalCode.trim();

        if (!name || !address || !postalCode) {
            setAccountMessage("نام، آدرس و کد پستی الزامی هستند");
            return;
        }

        try {
            setSavingAccount(true);
            setAccountMessage("");

            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    address,
                    postalCode,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setAccountMessage(data.error || "خطا در ذخیره اطلاعات");
                return;
            }

            if (setUser && data.user) {
                setUser(data.user);
            }

            setAccountMessage("اطلاعات با موفقیت ذخیره شد");
            setIsEditing(false);
        } catch (error) {
            console.error(error);
            setAccountMessage("خطا در ارتباط با سرور");
        } finally {
            setSavingAccount(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-center text-zinc-500 dark:text-zinc-400">
                در حال بارگذاری...
            </div>
        );
    }

    if (!user) return null;

    const tabs = [
        { id: "orders", label: "سفارشات" },
        { id: "wishlist", label: "مورد علاقه‌ها" },
        { id: "account", label: "اطلاعات حساب" },
    ];


    const cancelOrder = async (id) => {
        if (!confirm("این سفارش حذف شود؟"))
            return;

        try {
            const res = await fetch(`/api/order/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) return;

            setOrders((prev) =>
                prev.filter((o) => o.id !== id)
            );
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10" dir="rtl">
            <BackButton />

            {/* هدر پروفایل */}
            <div className="card mb-8 p-6">
                <div className="flex items-center justify-between">

                    {/* اطلاعات کاربر */}
                    <div className="flex items-center gap-4">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl font-black text-white shadow-lg">
                            {user.name?.[0]}
                        </div>

                        <div>
                            <h1 className="text-xl font-black text-[var(--color-primary)] dark:text-white">
                                {user.name}
                            </h1>

                            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                                {user.phone}
                            </p>
                        </div>

                    </div>

                    {/* دکمه خروج */}
                    <button
                        onClick={logout}
                        className="rounded-xl border border-red-500 px-5 py-2.5 text-sm font-bold text-red-500 transition hover:bg-red-500 hover:text-white"
                    >
                        خروج
                    </button>

                </div>
            </div>

            {/* تب‌ها */}
            <div className="flex flex-wrap gap-2 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab.id
                            ? "bg-[var(--color-primary)] text-white shadow-lg"
                            : "bg-[var(--background-card)] border border-zinc-200 dark:border-zinc-700 hover:border-[var(--color-primary)]"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* اطلاعات حساب */}
            {activeTab === "account" && (
                <div className="card p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-[var(--color-primary)] dark:text-white">اطلاعات حساب کاربری</h2>

                        {!isEditing ? (
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setAccountMessage("");
                                }}
                                className="btn-outline px-4 py-2 text-sm rounded-xl border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 transition"
                            >
                                ویرایش
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    setIsEditing(false);
                                    setAccountForm({
                                        name: user.name || "",
                                    });
                                    setAccountMessage("");
                                }}
                                className="btn-outline px-4 py-2 rounded-xl text-sm border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:bg-zinc-800 transition"
                            >
                                انصراف
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-500 dark:text-zinc-400">نام و نام خانوادگی</label>

                            {isEditing ? (
                                <input
                                    type="text"
                                    value={accountForm.name}
                                    onChange={(e) =>
                                        setAccountForm((prev) => ({
                                            ...prev,
                                            name: e.target.value,
                                        }))
                                    }
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100" />
                            ) : (
                                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
                                    {user.name}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-500 dark:text-zinc-400">شماره تلفن</label>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-[var(--color-primary)]">
                                {user.phone || "ثبت نشده"}
                            </div>
                        </div>

                        {accountMessage && (
                            <p
                                className={`text-sm ${accountMessage.includes("موفق")
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-500 dark:text-red-400"
                                    }`}
                            >
                                {accountMessage}
                            </p>
                        )}

                        {isEditing && (
                            <div className="pt-2">
                                <button
                                    onClick={handleSaveAccount}
                                    disabled={savingAccount}
                                    className="btn-primary px-5 py-3 rounded-xl disabled:opacity-50"
                                >
                                    {savingAccount ? "در حال ذخیره..." : "ذخیره تغییرات"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* سفارشات */}
            {activeTab === "orders" && (
                <div className="flex flex-col gap-4">
                    {ordersLoading ? (
                        <div className="card border-gray-100 p-10 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                            در حال بارگذاری سفارشات...
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="card border-gray-100 p-10 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                            هنوز سفارش نهایی‌شده‌ای ثبت نکردی
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2 mb-6">
                                <button
                                    onClick={() => setOrderTab("paid")}
                                    className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-medium transition ${orderTab === "paid"
                                        ? "bg-[var(--color-primary)] text-white shadow-lg"
                                        : "bg-[var(--background-card)] border border-zinc-200 dark:border-zinc-700 hover:border-[var(--color-primary)]"
                                        }`}
                                >
                                    پرداخت شده
                                </button>

                                <button
                                    onClick={() => setOrderTab("pending")}
                                    className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-medium transition ${orderTab === "pending"
                                        ? "bg-[var(--color-primary)] text-white shadow-lg"
                                        : "bg-[var(--background-card)] border border-zinc-200 dark:border-zinc-700 hover:border-[var(--color-primary)]"
                                        }`}
                                >
                                    در انتظار پرداخت
                                </button>
                            </div>
                            {(orderTab === "paid" ? paidOrders : pendingOrders).map((order) => {
                                const isHighlighted = highlightedOrderId && String(order.id) === highlightedOrderId;

                                return (
                                    <div
                                        key={order.id}
                                        className={` card p-5 transition-all ${isHighlighted
                                            ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]"
                                            : ""
                                            }`}
                                    >
                                        {isHighlighted && (
                                            <p className="text-xs text-green-600 font-medium mb-3">
                                                ✓ سفارش با موفقیت ثبت شد
                                            </p>
                                        )}

                                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">                                            <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-sm font-bold text-[var(--color-primary)] dark:text-white">
                                                سفارش #{order.id}
                                            </span>

                                            {order.paymentStatus === "PENDING" ? (
                                                <span className="text-xs px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700">
                                                    در انتظار پرداخت
                                                </span>
                                            ) : (
                                                order.paymentStatus === "PENDING" ? (
                                                    <span className="text-xs px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700">
                                                        در انتظار پرداخت
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`text-xs px-2 py-1 rounded-lg ${ORDER_STATUS_COLORS[order.status] ||
                                                            "bg-gray-100 text-gray-600"
                                                            }`}
                                                    >
                                                        {ORDER_STATUS_LABELS[order.status] || order.status}
                                                    </span>
                                                )
                                            )}

                                            {order.paymentRefId && (
                                                <span className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-700">
                                                    کد رهگیری: {order.paymentRefId}
                                                </span>
                                            )}
                                        </div>

                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-3">
                                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">                                                        <img
                                                        src={
                                                            item.product.images?.[0]?.url ||
                                                            item.product.image
                                                        }
                                                        alt={item.product.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => (e.target.style.display = "none")}
                                                    />
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-zinc-800 dark:text-zinc-100 line-clamp-1">
                                                            {item.product.title}
                                                        </p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                                            تعداد: {toPersianPrice(item.quantity)}
                                                        </p>
                                                    </div>

                                                    <p className="text-sm font-medium whitespace-nowrap">
                                                        {toPersianPrice((item.price * item.quantity))} تومان
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                        {order.paymentStatus === "PENDING" && (
                                            <div className="mt-4 border-t border-gray-100 pt-4">
                                                <p className="text-sm text-yellow-700 mb-3">
                                                    این سفارش هنوز پرداخت نشده است.
                                                </p>

                                                <button
                                                    onClick={() => {
                                                        window.location.href =
                                                            `https://sandbox.zarinpal.com/pg/StartPay/${order.authority}`;
                                                    }}
                                                    className="mt-3 bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition"
                                                >
                                                    ادامه پرداخت
                                                </button>
                                                <button
                                                    onClick={() => cancelOrder(order.id)}
                                                    className="mt-3 mr-2 border border-red-500 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 transition"
                                                >
                                                    لغو سفارش
                                                </button>
                                            </div>
                                        )}



                                        <div className="mt-6 flex items-center justify-between rounded-2xl bg-zinc-100 dark:bg-zinc-800/70 p-4">
                                            <span className="text-xl font-black text-[var(--color-primary)] dark:text-[var(--color-accent)]">
                                                {order.total.toLocaleString("fa-IR")} تومان
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* مورد علاقه‌ها */}
            {activeTab === "wishlist" && (
                <div className="card p-6">
                    <h2 className="mb-6 text-lg font-black text-[var(--color-primary)] dark:text-white">مورد علاقه‌ها</h2>

                    {wishlistLoading ? (
                        <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            در حال بارگذاری...
                        </div>
                    ) : wishlist.length === 0 ? (
                        <div className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                            هنوز محصولی به مورد علاقه‌ها اضافه نکردی
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {wishlist.map((item) => {
                                const product = item.product;
                                if (!product) return null;

                                return (
                                    <div
                                        key={item.id}
                                        className="card flex gap-4 p-4 transition hover:-translate-y-0.5"
                                    >
                                        <Link
                                            href={`/products/${product.id}`}
                                            className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800"
                                        >
                                            <img
                                                src={product.images?.[0]?.url || product.image}
                                                alt={product.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => (e.target.style.display = "none")}
                                            />
                                        </Link>

                                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                                            <div>
                                                <Link
                                                    href={`/products/${product.id}`}
                                                    className="text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2 hover:text-[var(--color-accent)] transition-colors"
                                                >
                                                    {product.title}
                                                </Link>

                                                <p className="mt-2 text-base font-extrabold text-[var(--color-primary)] dark:text-[var(--color-accent)]">
                                                    {toPersianPrice(product.price)} تومان
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between mt-3">
                                                <Link
                                                    href={`/products/${product.id}`}
                                                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[var(--color-accent)] transition-colors"                                                >
                                                    مشاهده محصول
                                                </Link>

                                                <button
                                                    onClick={() => removeFromWishlist(product.id)}
                                                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    return (
        <Suspense fallback={null}>
            <ProfileContent />
        </Suspense>
    );
}