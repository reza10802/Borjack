"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: "سفارش‌های امروز", value: stats.todayOrders, sub: "سفارش ثبت‌شده امروز" },
    { label: "کالاهای ناموجود", value: stats.outOfStock, sub: "نیاز به موجودی" },
    { label: "کل کالاها", value: stats.products, sub: "محصول فعال" },
    ...(user?.role === "ADMIN"
      ? [{ label: "کاربران", value: stats.users, sub: "حساب ثبت‌شده" }]
      : []),
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">داشبورد</h1>
        <p className="text-sm text-gray-500 mt-1">خلاصه وضعیت فروشگاه</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map((c) => (
            <div key={c.label} className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-3xl font-bold text-gray-900">{c.value?.toLocaleString("fa-IR")}</p>
              <p className="text-sm font-medium text-gray-700 mt-1">{c.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}