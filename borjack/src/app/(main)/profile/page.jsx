"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "../../../components/BackButton";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "../../../lib/orderStatus";

export default function ProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightedOrderId = searchParams.get("order");

    const [orders, setOrders] = useState([]);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(highlightedOrderId ? "orders" : "info");

    useEffect(() => {
        if (loading) return;
        if (!user) { router.push("/login"); return; }
        fetchOrders();
    }, [user, loading]);

    const fetchOrders = async () => {
        try {
            const res = await fetch("/api/orders");
            if (!res.ok) return;
            const data = await res.json();
            setOrders(data);
        } catch (error) {
            console.error(error);
        } finally {
            setOrdersLoading(false);
        }
    };

    if (loading || !user) return null;

    const tabs = [
        { id: "info", label: "اطلاعات حساب" },
        { id: "orders", label: "سفارشات" },
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10" dir="rtl">
            <BackButton />

            {/* هدر پروفایل */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
                        {user.name?.[0]}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
                        <p className="text-sm text-gray-500">{user.identifier}</p>
                    </div>
                </div>
            </div>

            {/* تب‌ها */}
            <div className="flex gap-2 mb-6">
                {tabs.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                            activeTab === tab.id ? "bg-black text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* اطلاعات حساب */}
            {activeTab === "info" && (
                <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="text-lg font-bold mb-6">اطلاعات حساب کاربری</h2>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">نام و نام خانوادگی</label>
                            <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50">
                                {user.name}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400">ایمیل یا شماره تلفن</label>
                            <div className="border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 bg-gray-50">
                                {user.identifier}
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            * برای ویرایش اطلاعات، پس از راه‌اندازی بک‌اند امکان‌پذیر خواهد بود.
                        </p>
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
                            هنوز سفارشی ثبت نکردی
                        </div>
                    ) : (
                        orders.map(order => {
                            const isHighlighted = highlightedOrderId && String(order.id) === highlightedOrderId;
                            return (
                                <div key={order.id}
                                    className={`bg-white rounded-2xl border p-5 ${isHighlighted ? "border-black ring-1 ring-black" : "border-gray-100"}`}>
                                    {isHighlighted && (
                                        <p className="text-xs text-green-600 font-medium mb-3">✓ سفارش با موفقیت ثبت شد</p>
                                    )}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-bold text-gray-800">سفارش #{order.id}</span>
                                            <span className={`text-xs px-2 py-1 rounded-lg ${ORDER_STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"}`}>
                                                {ORDER_STATUS_LABELS[order.status] || order.status}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        {order.items.map(item => (
                                            <div key={item.id} className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                                    <img
                                                        src={item.product.images?.[0]?.url || item.product.image}
                                                        alt={item.product.title}
                                                        className="w-full h-full object-cover"
                                                        onError={e => e.target.style.display = "none"}
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-gray-800 line-clamp-1">{item.product.title}</p>
                                                    <p className="text-xs text-gray-400">تعداد: {item.quantity}</p>
                                                </div>
                                                <p className="text-sm font-medium">{(item.price * item.quantity).toLocaleString()} تومان</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between items-center">
                                        <span className="text-sm text-gray-500">جمع کل</span>
                                        <span className="text-sm font-bold">{order.total.toLocaleString()} تومان</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}