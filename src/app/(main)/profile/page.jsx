"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "@/components/BackButton";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/lib/orderStatus";

function ProfileContent() {
    const { user, loading, setUser } = useAuth();
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
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 text-center text-gray-400">
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
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black flex items-center justify-center text-white text-xl sm:text-2xl font-bold shrink-0">
                        {user.name?.[0] || "U"}
                    </div>

                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                            {user.name}
                        </h1>
                        <p className="text-sm text-gray-500 break-all">
                            {user.phone || "شماره ثبت نشده"}
                        </p>
                    </div>
                </div>
            </div>

            {/* تب‌ها */}
            <div className="flex flex-wrap gap-2 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 sm:px-5 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab.id
                            ? "bg-black text-white"
                            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* اطلاعات حساب */}
            {activeTab === "account" && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-bold">اطلاعات حساب کاربری</h2>

                        {!isEditing ? (
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setAccountMessage("");
                                }}
                                className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition"
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
                                className="px-4 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 transition"
                            >
                                انصراف
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">نام و نام خانوادگی</label>

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
                                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:border-black"
                                />
                            ) : (
                                <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50">
                                    {user.name}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">شماره تلفن</label>
                            <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50">
                                {user.phone || "ثبت نشده"}
                            </div>
                        </div>

                        {accountMessage && (
                            <p
                                className={`text-sm ${accountMessage.includes("موفق")
                                    ? "text-green-600"
                                    : "text-red-500"
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
                                    className="px-5 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
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
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                            در حال بارگذاری سفارشات...
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                            هنوز سفارش نهایی‌شده‌ای ثبت نکردی
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2 mb-5">
                                <button
                                    onClick={() => setOrderTab("paid")}
                                    className={`px-4 py-2 rounded-xl text-sm transition ${orderTab === "paid"
                                        ? "bg-black text-white"
                                        : "border border-gray-200 text-gray-600"
                                        }`}
                                >
                                    پرداخت شده
                                </button>

                                <button
                                    onClick={() => setOrderTab("pending")}
                                    className={`px-4 py-2 rounded-xl text-sm transition ${orderTab === "pending"
                                        ? "bg-black text-white"
                                        : "border border-gray-200 text-gray-600"
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
                                        className={`bg-white rounded-2xl border p-4 sm:p-5 ${isHighlighted
                                            ? "border-black ring-1 ring-black"
                                            : "border-gray-100"
                                            }`}
                                    >
                                        {isHighlighted && (
                                            <p className="text-xs text-green-600 font-medium mb-3">
                                                ✓ سفارش با موفقیت ثبت شد
                                            </p>
                                        )}

                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-bold text-gray-800">
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

                                            <span className="text-xs text-gray-400">
                                                {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-3">
                                            {order.items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                                        <img
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
                                                        <p className="text-sm text-gray-800 line-clamp-1">
                                                            {item.product.title}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            تعداد: {item.quantity}
                                                        </p>
                                                    </div>

                                                    <p className="text-sm font-medium whitespace-nowrap">
                                                        {(item.price * item.quantity).toLocaleString()} تومان
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



                                        <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-center">
                                            <span className="text-sm text-gray-500">جمع کل</span>
                                            <span className="text-sm font-bold">
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
                <div className="bg-white rounded-2xl border border-gray-100 p-5 sm:p-6">
                    <h2 className="text-lg font-bold mb-5">مورد علاقه‌ها</h2>

                    {wishlistLoading ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
                            در حال بارگذاری...
                        </div>
                    ) : wishlist.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 text-sm">
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
                                        className="border border-gray-100 rounded-2xl p-4 flex gap-3"
                                    >
                                        <Link
                                            href={`/products/${product.id}`}
                                            className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0"
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
                                                    className="text-sm font-medium text-gray-800 line-clamp-2 hover:text-black"
                                                >
                                                    {product.title}
                                                </Link>

                                                <p className="text-sm font-bold text-gray-900 mt-2">
                                                    {product.price.toLocaleString()} تومان
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between mt-3">
                                                <Link
                                                    href={`/products/${product.id}`}
                                                    className="text-xs text-black font-medium hover:underline"
                                                >
                                                    مشاهده محصول
                                                </Link>

                                                <button
                                                    onClick={() => removeFromWishlist(product.id)}
                                                    className="text-xs text-red-500 hover:text-red-600 transition"
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