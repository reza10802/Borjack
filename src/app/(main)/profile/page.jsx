
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import {
    ORDER_STATUS_LABELS,
    ORDER_STATUS_COLORS,
} from "@/lib/orderStatus";
import { toPersianPrice } from "@/lib/utils";
import Image from "next/image";

const FULFILLMENT_STATUS_LABELS = {
    PREPARING: "در حال آماده‌سازی",
    READY_FOR_HANDOVER: "آماده تحویل به پست",
    HANDED_TO_CARRIER: "تحویل به شرکت حمل‌ونقل",
    SHIPPED: "ارسال‌شده",
    DELIVERED: "تحویل شده",
    ISSUE: "نیازمند رسیدگی",
};

const FULFILLMENT_STATUS_COLORS = {
    PREPARING:
        "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
    READY_FOR_HANDOVER:
        "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    HANDED_TO_CARRIER:
        "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
    SHIPPED:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    DELIVERED:
        "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-300",
    ISSUE:
        "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300",
};

const SHIPPING_METHOD_LABELS = {
    POST: "پست عادی",
    POST_EXPRESS: "پست پیشتاز",
};

function formatDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toLocaleDateString("fa-IR");
}

function ProfileContent() {
    const { user, loading, logout, setUser } = useAuth();
    const { showToast, showConfirm } = useUI();

    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightedOrderId = searchParams.get("order");

    const [orders, setOrders] = useState([]);
    const [orderTab, setOrderTab] = useState("paid");
    const [copiedTrackingCode, setCopiedTrackingCode] = useState(null);

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

    const paidOrders = orders.filter(
        (order) => order.paymentStatus === "PAID"
    );

    const pendingOrders = orders.filter(
        (order) => order.paymentStatus === "PENDING"
    );

    // دریافت علاقه‌مندی‌ها برای رویدادهای بعدی صفحه
    const fetchWishlist = useCallback(async () => {
        try {
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
            console.error("FETCH_WISHLIST_ERROR", error);
            setWishlist([]);
        } finally {
            setWishlistLoading(false);
        }
    }, []);

    // بارگذاری اولیه اطلاعات
    useEffect(() => {
        if (loading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        let cancelled = false;

        // دریافت سفارش‌ها
        fetch("/api/order", {
            cache: "no-store",
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch orders");
                }

                return res.json();
            })
            .then((data) => {
                if (!cancelled) {
                    setOrders(
                        Array.isArray(data) ? data : []
                    );
                }
            })
            .catch((error) => {
                console.error("FETCH_ORDERS_ERROR", error);

                if (!cancelled) {
                    setOrders([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setOrdersLoading(false);
                }
            });

        // دریافت علاقه‌مندی‌ها
        fetch("/api/wishlist", {
            cache: "no-store",
        })
            .then(async (res) => {
                if (!res.ok) {
                    throw new Error("Failed to fetch wishlist");
                }

                return res.json();
            })
            .then((data) => {
                if (!cancelled) {
                    setWishlist(
                        Array.isArray(data) ? data : []
                    );
                }
            })
            .catch((error) => {
                console.error("FETCH_WISHLIST_ERROR", error);

                if (!cancelled) {
                    setWishlist([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setWishlistLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user, loading, router]);

    // هماهنگی علاقه‌مندی‌ها با سایر بخش‌های سایت
    useEffect(() => {
        const refetchWishlist = () => {
            if (user) {
                fetchWishlist();
            }
        };

        window.addEventListener(
            "wishlist-updated",
            refetchWishlist
        );

        return () => {
            window.removeEventListener(
                "wishlist-updated",
                refetchWishlist
            );
        };
    }, [user, fetchWishlist]);

    const copyTrackingCode = async (fulfillmentId, code) => {
        try {
            await navigator.clipboard.writeText(code);

            setCopiedTrackingCode(fulfillmentId);
        } catch (error) {
            console.error("COPY_TRACKING_CODE_ERROR", error);

            showToast("کپی کد رهگیری انجام نشد", {
                type: "error",
            });
        }
    };

    const removeFromWishlist = async (productId) => {
        try {
            const res = await fetch(`/api/wishlist/${productId}`, {
                method: "DELETE",
            });

            if (!res.ok) return;

            setWishlist((prev) =>
                prev.filter(
                    (item) => item.productId !== productId
                )
            );

            window.dispatchEvent(
                new Event("wishlist-updated")
            );
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveAccount = async () => {
        const name = accountForm.name.trim();

        if (!name) {
            setAccountMessage("نام الزامی است");
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
                body: JSON.stringify({ name }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setAccountMessage(
                    data.error || "خطا در ذخیره اطلاعات"
                );
                return;
            }

            if (typeof setUser === "function" && data.user) {
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

    // پرداخت همیشه از مسیر امن سرور شروع می‌شود.
    const continuePayment = async (orderId) => {
        try {
            const res = await fetch("/api/payment/request", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({ orderId }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data?.paymentUrl) {
                showToast(
                    data?.error || "امکان شروع پرداخت وجود ندارد",
                    { type: "error" }
                );
                return;
            }

            window.location.assign(data.paymentUrl);
        } catch (error) {
            console.error("CONTINUE PAYMENT ERROR:", error);

            showToast("خطا در ارتباط با سرور", {
                type: "error",
            });
        }
    };

    const cancelOrder = async (id) => {
        const confirmed = await showConfirm({
            title: "لغو سفارش",
            description: "آیا از لغو این سفارش مطمئن هستید؟",
            confirmText: "لغو سفارش",
            cancelText: "بازگشت",
            danger: true,
        });

        if (!confirmed) return;

        try {
            const res = await fetch(`/api/order/${id}`, {
                method: "DELETE",
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                showToast(
                    data.error || "لغو سفارش انجام نشد",
                    { type: "error" }
                );
                return;
            }

            setOrders((prev) =>
                prev.filter((order) => order.id !== id)
            );

            showToast("سفارش با موفقیت لغو شد.", {
                type: "success",
            });
        } catch (error) {
            console.error("CANCEL ORDER ERROR:", error);

            showToast("خطا در ارتباط با سرور هنگام لغو سفارش", {
                type: "error",
            });
        }
    };

    // نمایش کالاهای داخل یک مرسوله
    const renderFulfillmentItems = (fulfillment) => (
        <div className="flex flex-col gap-4">
            {(fulfillment.items || []).map((parcelItem) => {
                const orderItem = parcelItem.orderItem;
                const product = orderItem?.product;

                if (!product) return null;

                return (
                    <div
                        key={parcelItem.id}
                        className="flex items-center gap-3"
                    >
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                            <Image
                                src={
                                    product.images?.[0]?.url ||
                                    product.image
                                }
                                alt={product.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                }}
                            />
                        </div>

                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-zinc-800 dark:text-zinc-100 line-clamp-2">
                                {product.title}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                تعداد:{" "}
                                {toPersianPrice(parcelItem.quantity)}
                            </p>
                        </div>

                        <p className="text-xs sm:text-sm font-medium whitespace-nowrap">
                            {toPersianPrice(
                                orderItem.price * parcelItem.quantity
                            )} تومان
                        </p>
                    </div>
                );
            })}
        </div>
    );

    // نمایش سفارش‌های قدیمی بدون مرسوله
    const renderLegacyOrderItems = (order) => (
        <div className="flex flex-col gap-3">
            {order.items.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center gap-3"
                >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                        <Image
                            src={
                                item.product?.images?.[0]?.url ||
                                item.product?.image
                            }
                            alt={item.product?.title || ""}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-800 dark:text-zinc-100 line-clamp-1">
                            {item.product?.title}
                        </p>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            تعداد: {toPersianPrice(item.quantity)}
                        </p>
                    </div>

                    <p className="text-sm font-medium whitespace-nowrap">
                        {toPersianPrice(
                            item.price * item.quantity
                        )} تومان
                    </p>
                </div>
            ))}
        </div>
    );

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

    return (
        <div
            className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"
            dir="rtl"
        >
            <BackButton />

            {/* هدر پروفایل */}
            <div className="card mb-8 p-6">
                <div className="flex items-center justify-between">
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
                        <h2 className="text-lg font-black text-[var(--color-primary)] dark:text-white">
                            اطلاعات حساب کاربری
                        </h2>

                        {!isEditing ? (
                            <button
                                onClick={() => {
                                    setAccountForm({
                                        name: user.name || "",
                                        address: user.address || "",
                                        postalCode: user.postalCode || "",
                                    });

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
                                        address: user.address || "",
                                        postalCode: user.postalCode || "",
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
                            <label className="text-xs text-zinc-500 dark:text-zinc-400">
                                نام و نام خانوادگی
                            </label>

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
                                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100"
                                />
                            ) : (
                                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
                                    {user.name}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-zinc-500 dark:text-zinc-400">
                                شماره تلفن
                            </label>

                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
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
                                    {savingAccount
                                        ? "در حال ذخیره..."
                                        : "ذخیره تغییرات"}
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

                            {(orderTab === "paid"
                                ? paidOrders
                                : pendingOrders
                            ).map((order) => {
                                const isHighlighted =
                                    highlightedOrderId &&
                                    String(order.id) === highlightedOrderId;

                                const fulfillments = Array.isArray(
                                    order.fulfillments
                                )
                                    ? order.fulfillments
                                    : [];

                                const hasFulfillments =
                                    fulfillments.length > 0;

                                const isMultiShipment =
                                    fulfillments.length > 1;

                                return (
                                    <div
                                        key={order.id}
                                        className={`card p-5 transition-all ${isHighlighted
                                                ? "ring-2 ring-[var(--color-primary)] border-[var(--color-primary)]"
                                                : ""
                                            }`}
                                    >
                                        {isHighlighted && (
                                            <p className="text-xs text-green-600 font-medium mb-3">
                                                ✓ سفارش با موفقیت ثبت شد
                                            </p>
                                        )}

                                        {/* عنوان سفارش */}
                                        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-bold text-[var(--color-primary)] dark:text-white">
                                                    سفارش #{order.id}
                                                </span>

                                                {order.paymentStatus === "PENDING" ? (
                                                    <span className="text-xs px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700">
                                                        در انتظار پرداخت
                                                    </span>
                                                ) : (
                                                    <span
                                                        className={`text-xs px-2 py-1 rounded-lg ${ORDER_STATUS_COLORS[order.status] ||
                                                            "bg-gray-100 text-gray-600"
                                                            }`}
                                                    >
                                                        {ORDER_STATUS_LABELS[order.status] ||
                                                            order.status}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                                {formatDate(order.createdAt)}
                                            </span>
                                        </div>

                                        {/* محتوای سفارش */}
                                        {hasFulfillments ? (
                                            <div className="flex flex-col gap-4">
                                                {isMultiShipment && (
                                                    <div className="rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-500/10 p-4">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="20"
                                                                height="20"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="currentColor"
                                                                strokeWidth="2"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                className="text-blue-600 dark:text-blue-400 shrink-0"
                                                            >
                                                                <circle cx="12" cy="12" r="10" />
                                                                <path d="M12 16v-4" />
                                                                <path d="M12 8h.01" />
                                                            </svg>

                                                            <p className="font-bold text-sm text-blue-800 dark:text-blue-300">
                                                                سفارش شما در چند مرسوله ارسال می‌شود
                                                            </p>
                                                        </div>

                                                        <p className="text-xs leading-6 text-blue-700 dark:text-blue-300">
                                                            بسته‌های سفارش شما به‌صورت جداگانه ارسال می‌شوند.
                                                            هر بسته کد رهگیری مستقل دارد و وضعیت آن را
                                                            می‌توانید در همین صفحه مشاهده کنید.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* مرسوله‌ها */}
                                                {fulfillments.map(
                                                    (fulfillment, index) => (
                                                        <div
                                                            key={fulfillment.id}
                                                            className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
                                                        >
                                                            <div className="flex flex-wrap items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/70 p-4">
                                                                <div>
                                                                    <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100">
                                                                        {isMultiShipment
                                                                            ? `مرسوله ${toPersianPrice(index + 1)} از ${toPersianPrice(fulfillments.length)}`
                                                                            : "اطلاعات ارسال"}
                                                                    </p>

                                                                    {fulfillment.shippingMethod && (
                                                                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                                            روش ارسال:{" "}
                                                                            {SHIPPING_METHOD_LABELS[
                                                                                fulfillment.shippingMethod
                                                                            ] ||
                                                                                fulfillment.shippingMethod}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                <span
                                                                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${FULFILLMENT_STATUS_COLORS[
                                                                        fulfillment.status
                                                                        ] ||
                                                                        "bg-zinc-100 text-zinc-600"
                                                                        }`}
                                                                >
                                                                    {FULFILLMENT_STATUS_LABELS[
                                                                        fulfillment.status
                                                                    ] ||
                                                                        fulfillment.status}
                                                                </span>
                                                            </div>

                                                            <div className="p-4 flex flex-col gap-4">
                                                                {renderFulfillmentItems(
                                                                    fulfillment
                                                                )}

                                                                {/* کد رهگیری */}
                                                                <div className="border-t border-zinc-100 dark:border-zinc-700 pt-4">
                                                                    {fulfillment.trackingCode ? (
                                                                        <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800 p-3">
                                                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                                                                                کد رهگیری این مرسوله
                                                                            </p>

                                                                            <div className="flex items-center justify-between gap-3">
                                                                                <span
                                                                                    dir="ltr"
                                                                                    className="font-bold text-sm tracking-wider text-zinc-800 dark:text-zinc-100 break-all"
                                                                                >
                                                                                    {fulfillment.trackingCode}
                                                                                </span>

                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        copyTrackingCode(
                                                                                            fulfillment.id,
                                                                                            fulfillment.trackingCode
                                                                                        )
                                                                                    }
                                                                                    className="shrink-0 rounded-lg px-3 py-2 text-xs font-bold bg-[var(--color-primary)] text-white hover:opacity-90 transition"
                                                                                >
                                                                                    {copiedTrackingCode === fulfillment.id
                                                                                        ? "کپی شد"
                                                                                        : "کپی"}
                                                                                </button>
                                                                            </div>

                                                                            {fulfillment.trackingCodeAddedAt && (
                                                                                <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                                                                                    تاریخ ثبت:{" "}
                                                                                    {formatDate(
                                                                                        fulfillment.trackingCodeAddedAt
                                                                                    )}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    ) : fulfillment.status === "ISSUE" ? (
                                                                        <p className="text-xs leading-6 text-red-600 dark:text-red-400">
                                                                            این مرسوله نیازمند رسیدگی است.
                                                                        </p>
                                                                    ) : (
                                                                        <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400">
                                                                            کد رهگیری پس از تحویل بسته به شرکت حمل‌ونقل
                                                                            و ثبت آن در این قسمت نمایش داده می‌شود.
                                                                        </p>
                                                                    )}

                                                                    {fulfillment.deliveredAt && (
                                                                        <p className="mt-3 text-xs text-green-600 dark:text-green-400">
                                                                            تاریخ تحویل:{" "}
                                                                            {formatDate(
                                                                                fulfillment.deliveredAt
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            renderLegacyOrderItems(order)
                                        )}

                                        {/* پرداخت سفارش */}
                                        {order.paymentStatus === "PENDING" && (
                                            <div className="mt-4 border-t border-gray-100 pt-4">
                                                <p className="text-sm text-yellow-700 mb-3">
                                                    این سفارش هنوز پرداخت نشده است.
                                                </p>

                                                <button
                                                    onClick={() =>
                                                        continuePayment(order.id)
                                                    }
                                                    className="mt-3 bg-black text-white px-4 py-2 rounded-xl hover:bg-gray-800 transition"
                                                >
                                                    ادامه پرداخت
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        cancelOrder(order.id)
                                                    }
                                                    className="mt-3 mr-2 border border-red-500 text-red-500 px-4 py-2 rounded-xl hover:bg-red-50 transition"
                                                >
                                                    لغو سفارش
                                                </button>
                                            </div>
                                        )}

                                        {/* مبلغ کل سفارش */}
                                        <div className="mt-6 flex items-center justify-between rounded-2xl bg-zinc-100 dark:bg-zinc-800/70 p-4">
                                            <span className="text-sm text-zinc-500 dark:text-zinc-400">
                                                مبلغ کل سفارش
                                            </span>

                                            <span className="text-xl font-black text-[var(--color-primary)] dark:text-[var(--color-accent)]">
                                                {toPersianPrice(order.total)} تومان
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
                    <h2 className="mb-6 text-lg font-black text-[var(--color-primary)] dark:text-white">
                        مورد علاقه‌ها
                    </h2>

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
                                            <Image
                                                src={
                                                    product.images?.[0]?.url ||
                                                    product.image
                                                }
                                                alt={product.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.style.display = "none";
                                                }}
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
                                                    className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[var(--color-accent)] transition-colors"
                                                >
                                                    مشاهده محصول
                                                </Link>

                                                <button
                                                    onClick={() =>
                                                        removeFromWishlist(product.id)
                                                    }
                                                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                                                >
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
