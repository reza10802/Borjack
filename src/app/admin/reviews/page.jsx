"use client";

import { useEffect, useState } from "react";

const STARS = (rating) =>
  [1, 2, 3, 4, 5].map((i) => (
    <span
      key={i}
      className={`leading-none ${i <= rating ? "text-yellow-400" : "text-gray-300 dark:text-zinc-600"
        }`}
    >
      ★
    </span>
  ));

export default function AdminReviews() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/reviews?filter=${filter}`, {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت نظرات");
        setReviews([]);
        return;
      }

      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (error) {
      console.error("LOAD REVIEWS ERROR:", error);
      setError("خطا در ارتباط با سرور");
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const handleApprove = async (id, approved) => {
    setUpdating(id);
    setError("");

    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewId: id,
          approved,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت نظر");
        return;
      }

      await load();
    } catch (error) {
      console.error("UPDATE REVIEW ERROR:", error);
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("حذف این نظر؟")) return;

    setError("");

    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در حذف نظر");
        return;
      }

      await load();
    } catch (error) {
      console.error("DELETE REVIEW ERROR:", error);
      setError("خطا در ارتباط با سرور");
    }
  };

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          نظرات
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {reviews.length} نظر
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6 p-3">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "pending", label: "در انتظار تایید" },
            { key: "approved", label: "تایید شده" },
            { key: "all", label: "همه" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`h-10 rounded-xl px-4 text-sm font-medium transition ${filter === tab.key
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-[var(--color-surface-2)]"
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="card py-14 text-center text-sm text-[var(--color-text-muted)]">
          نظری یافت نشد
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="card min-w-0 rounded-2xl p-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-col gap-4">
                {/* Review Content */}
                <div className="min-w-0">
                  {/* User + Rating + Status */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-text)]">
                      {r.user || "کاربر"}
                    </span>

                    <div
                      className="flex shrink-0 items-center gap-0.5 text-sm"
                      aria-label={`امتیاز ${r.rating} از 5`}
                    >
                      {STARS(r.rating)}
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ${r.approved
                          ? "bg-green-500/10 text-green-500"
                          : "bg-yellow-500/10 text-yellow-500"
                        }`}
                    >
                      {r.approved ? "تایید شده" : "در انتظار"}
                    </span>
                  </div>

                  {/* Comment */}
                  <p className="mt-3 text-sm leading-7 text-[var(--color-text)] break-words">
                    {r.comment || "—"}
                  </p>

                  {/* Product + Date */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span className="truncate max-w-full">
                      {r.product?.title || "کالای نامشخص"}
                    </span>

                    <span className="hidden sm:inline">—</span>

                    <span className="whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex w-full flex-wrap gap-2 border-t border-[var(--color-border)] pt-3 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
                  {!r.approved ? (
                    <button
                      type="button"
                      onClick={() => handleApprove(r.id, true)}
                      disabled={updating === r.id}
                      className="h-9 min-w-[92px] rounded-lg bg-green-500/10 px-3 text-xs font-medium text-green-500 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updating === r.id ? "..." : "تایید"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApprove(r.id, false)}
                      disabled={updating === r.id}
                      className="h-9 min-w-[92px] rounded-lg bg-yellow-500/10 px-3 text-xs font-medium text-yellow-600 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updating === r.id ? "..." : "رد تایید"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="h-9 min-w-[92px] rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
