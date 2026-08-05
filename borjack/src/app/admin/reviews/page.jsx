"use client";

import { useEffect, useState } from "react";

const STARS = (rating) =>
  [1, 2, 3, 4, 5].map((i) => (
    <span key={i} className={i <= rating ? "text-yellow-400" : "text-gray-200"}>
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
      const res = await fetch(`/api/admin/reviews?filter=${filter}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت نظرات");
        setReviews([]);
        return;
      }

      setReviews(data.reviews || []);
    } catch {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: id, approved }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت نظر");
        return;
      }

      load();
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("حذف این نظر؟")) return;

    setError("");

    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در حذف نظر");
        return;
      }

      load();
    } catch {
      setError("خطا در ارتباط با سرور");
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            نظرات
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {reviews.length} نظر
          </p>
        </div>
      </div>
      {error && (
        <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: "pending", label: "در انتظار تایید" },
          { key: "approved", label: "تایید شده" },
          { key: "all", label: "همه" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`rounded-xl px-4 py-2 text-sm transition
        ${filter === t.key
                ? "bg-[var(--color-accent)] text-white"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)]"
              }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-[var(--color-surface-2)]"
            />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-14 text-center text-sm text-[var(--color-text-muted)]">
          نظری یافت نشد
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--color-text)]">
                      {r.user}
                    </span>
                    <div className="flex text-sm">{STARS(r.rating)}</div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${r.approved
                        ? "bg-green-500/10 text-green-500"
                        : "bg-yellow-500/10 text-yellow-500"
                        }`}
                    >
                      {r.approved ? "تایید شده" : "در انتظار"}
                    </span>
                  </div>

                  <p className="mb-2 text-sm leading-7 text-[var(--color-text)]">
                    {r.comment}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {r.product?.title} —{" "}
                    {new Date(r.createdAt).toLocaleDateString("fa-IR")}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {!r.approved ? (
                    <button
                      onClick={() => handleApprove(r.id, true)}
                      disabled={updating === r.id}
                      className="rounded-xl bg-green-500/10 px-3 py-2 text-xs font-medium text-green-500 transition hover:bg-green-500/20 disabled:opacity-50"
                    >
                      تایید
                    </button>
                  ) : (
                    <button
                      onClick={() => handleApprove(r.id, false)}
                      disabled={updating === r.id}
                      className="rounded-xl bg-yellow-500/10 px-3 py-2 text-xs font-medium text-yellow-600 transition hover:bg-yellow-500/20 disabled:opacity-50"
                    >
                      رد تایید
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(r.id)}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-500/20"
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