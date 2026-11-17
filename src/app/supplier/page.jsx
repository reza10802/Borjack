"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CARDS = [
  { key: "all", label: "همه کالاهای من" },
  { key: "published", label: "منتشرشده" },
  { key: "unpublished", label: "منتشرنشده" },
  { key: "archived", label: "آرشیو" },
  { key: "outOfStock", label: "ناموجود (منتشرشده)" },
];

export default function SupplierDashboardPage() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/supplier/products?limit=1", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return setError(data.error || "خطا در دریافت اطلاعات");
        setCounts(data.counts);
      } catch {
        if (!cancelled) setError("خطا در ارتباط با سرور");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">داشبورد فروشگاه</h1>

      {error && <p className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((card) => (
          <div key={card.key} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{counts ? (counts[card.key] ?? 0).toLocaleString("fa-IR") : "…"}</p>
          </div>
        ))}
      </div>

      <Link href="/supplier/products" className="inline-flex h-10 items-center rounded-xl btn-primary px-5 text-sm font-medium">
        مشاهده کالاهای من
      </Link>

      <p className="text-sm text-[var(--color-text-muted)]">
        ایجاد و ویرایش کالا در مرحله بعد فعال می‌شود. محصولات فقط با تأیید مدیریت منتشر خواهند شد.
      </p>
    </div>
  );
}
