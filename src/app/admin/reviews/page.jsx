
"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";

const STARS = (rating) =>
  [1, 2, 3, 4, 5].map((i) => (
    <span
      key={i}
      className={`leading-none ${
        i <= rating
          ? "text-yellow-400"
          : "text-gray-300 dark:text-zinc-600"
      }`}
    >
      ★
    </span>
  ));

export default function AdminReviews() {
  const { showToast, showConfirm } = useUI();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");

  // دریافت نظرات
  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    fetch(
      `/api/admin/reviews?filter=${encodeURIComponent(filter)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      }
    )
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت نظرات"
          );
        }

        return data;
      })
      .then((data) => {
        if (ignore) return;

        setReviews(
          Array.isArray(data.reviews)
            ? data.reviews
            : []
        );

        setError("");
      })
      .catch((error) => {
        if (
          ignore ||
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("LOAD REVIEWS ERROR:", error);

        setError(
          error.message || "خطا در ارتباط با سرور"
        );

        setReviews([]);
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [filter, reloadKey]);

  // تغییر فیلتر
  const handleFilterChange = (nextFilter) => {
    if (filter === nextFilter) return;

    setLoading(true);
    setError("");
    setFilter(nextFilter);
  };

  // تأیید یا رد نظر
  const handleApprove = async (id, approved) => {
    if (updating !== null) return;

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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error || "خطا در تغییر وضعیت نظر"
        );
        return;
      }

      showToast(
        approved
          ? "نظر با موفقیت تأیید شد."
          : "تأیید نظر با موفقیت لغو شد.",
        { type: "success" }
      );

      setLoading(true);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      console.error("UPDATE REVIEW ERROR:", error);

      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  // حذف نظر
  const handleDelete = async (review) => {
    if (deleting !== null) return;

    const confirmed = await showConfirm({
      title: "حذف نظر مشتری",
      description: `آیا از حذف نظر ثبت‌شده توسط «${review.user || "کاربر"}» مطمئن هستی؟ این عملیات قابل بازگشت نیست.`,
      confirmText: "حذف نظر",
      cancelText: "انصراف",
      danger: true,
    });

    if (!confirmed) return;

    setDeleting(review.id);
    setError("");

    try {
      const res = await fetch(
        `/api/admin/reviews?id=${encodeURIComponent(review.id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error || "خطا در حذف نظر"
        );
        return;
      }

      showToast(
        data.message || "نظر با موفقیت حذف شد.",
        { type: "success" }
      );

      setLoading(true);
      setReloadKey((prev) => prev + 1);
    } catch (error) {
      console.error("DELETE REVIEW ERROR:", error);

      setError("خطا در ارتباط با سرور");
    } finally {
      setDeleting(null);
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
          {reviews.length.toLocaleString("fa-IR")} نظر
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-500"
        >
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
              onClick={() => handleFilterChange(tab.key)}
              className={`h-10 rounded-xl px-4 text-sm font-medium transition ${
                filter === tab.key
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
          {error
            ? "دریافت نظرات ناموفق بود."
            : "نظری یافت نشد"}
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="card min-w-0 rounded-2xl p-4 sm:p-5"
            >
              <div className="flex min-w-0 flex-col gap-4">
                {/* Review Content */}
                <div className="min-w-0">
                  {/* User + Rating + Status */}
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="truncate text-sm font-semibold text-[var(--color-text)]">
                      {review.user || "کاربر"}
                    </span>

                    <div
                      className="flex shrink-0 items-center gap-0.5 text-sm"
                      aria-label={`امتیاز ${review.rating} از 5`}
                    >
                      {STARS(review.rating)}
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        review.approved
                          ? "bg-green-500/10 text-green-500"
                          : "bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {review.approved
                        ? "تایید شده"
                        : "در انتظار"}
                    </span>
                  </div>

                  {/* Comment */}
                  <p className="mt-3 break-words text-sm leading-7 text-[var(--color-text)]">
                    {review.comment || "—"}
                  </p>

                  {/* Product + Date */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-text-muted)]">
                    <span className="max-w-full truncate">
                      {review.product?.title || "کالای نامشخص"}
                    </span>

                    <span className="hidden sm:inline">
                      —
                    </span>

                    <span className="whitespace-nowrap">
                      {new Date(
                        review.createdAt
                      ).toLocaleDateString("fa-IR")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex w-full flex-wrap gap-2 border-t border-[var(--color-border)] pt-3 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
                  {!review.approved ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleApprove(review.id, true)
                      }
                      disabled={
                        updating !== null ||
                        deleting !== null
                      }
                      className="h-9 min-w-[92px] rounded-lg bg-green-500/10 px-3 text-xs font-medium text-green-500 transition hover:bg-green-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updating === review.id
                        ? "..."
                        : "تایید"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        handleApprove(review.id, false)
                      }
                      disabled={
                        updating !== null ||
                        deleting !== null
                      }
                      className="h-9 min-w-[92px] rounded-lg bg-yellow-500/10 px-3 text-xs font-medium text-yellow-600 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updating === review.id
                        ? "..."
                        : "رد تایید"}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(review)}
                    disabled={
                      deleting !== null ||
                      updating !== null
                    }
                    className="h-9 min-w-[92px] rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs font-medium text-red-500 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting === review.id
                      ? "در حال حذف..."
                      : "حذف"}
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
