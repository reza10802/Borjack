
"use client";

import { useCallback, useEffect, useState } from "react";
import { useUI } from "@/context/UIContext";

export default function AdminCategories() {
  const { showToast, showConfirm } = useUI();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  // بارگذاری اولیه دسته‌بندی‌ها
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch("/api/admin/categories", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت دسته‌بندی‌ها"
          );
        }

        return data;
      })
      .then((data) => {
        if (cancelled) return;

        setCategories(
          Array.isArray(data.categories)
            ? data.categories
            : []
        );

        setLoadError("");
      })
      .catch((error) => {
        if (cancelled || error.name === "AbortError") {
          return;
        }

        console.error("LOAD CATEGORIES ERROR:", error);

        setLoadError(
          error.message || "خطا در ارتباط با سرور"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  // دریافت مجدد دسته‌بندی‌ها
  const load = useCallback(async ({ showLoading = false } = {}) => {
    if (showLoading) {
      setLoading(true);
      setLoadError("");
    }

    try {
      const res = await fetch("/api/admin/categories", {
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "خطا در دریافت دسته‌بندی‌ها"
        );
      }

      setCategories(
        Array.isArray(data.categories)
          ? data.categories
          : []
      );

      setLoadError("");
    } catch (error) {
      console.error("LOAD CATEGORIES ERROR:", error);

      setLoadError(
        error.message || "خطا در ارتباط با سرور"
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // تلاش مجدد برای دریافت دسته‌بندی‌ها
  const handleRetry = () => {
    if (loading) return;

    load({ showLoading: true });
  };

  // افزودن دسته‌بندی
  const handleAdd = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("عنوان دسته‌بندی را وارد کن");
      return;
    }

    if (saving) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: trimmedTitle,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(
          data.error || "افزودن دسته‌بندی انجام نشد"
        );
        return;
      }

      setTitle("");

      showToast(
        data.message || "دسته‌بندی با موفقیت اضافه شد.",
        { type: "success" }
      );

      await load();
    } catch (error) {
      console.error("ADD CATEGORY ERROR:", error);

      showToast("خطا در ارتباط با سرور", {
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // حذف دسته‌بندی
  const handleDelete = async (category) => {
    if (deletingId !== null) return;

    const confirmed = await showConfirm({
      title: "حذف دسته‌بندی",
      description: `آیا از حذف دسته‌بندی «${category.title}» مطمئن هستی؟`,
      confirmText: "حذف دسته‌بندی",
      cancelText: "انصراف",
      danger: true,
    });

    if (!confirmed) return;

    setDeletingId(category.id);

    try {
      const res = await fetch(
        `/api/admin/categories?id=${encodeURIComponent(category.id)}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "حذف دسته‌بندی انجام نشد"
        );
      }

      showToast(
        data.message || "دسته‌بندی با موفقیت حذف شد.",
        { type: "success" }
      );

      await load();
    } catch (error) {
      console.error("DELETE CATEGORY ERROR:", error);

      showToast(
        error.message || "خطا در حذف دسته‌بندی",
        { type: "error" }
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div dir="rtl">
      {/* عنوان صفحه */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          دسته‌بندی‌ها
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {categories.length.toLocaleString("fa-IR")} دسته‌بندی
        </p>
      </div>

      {/* فرم افزودن */}
      <div className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
          افزودن دسته‌بندی جدید
        </h2>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !saving) {
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder="عنوان دسته‌بندی — مثلاً: پزشکی"
            disabled={saving}
            className="
              h-11 min-w-0 flex-1
              rounded-xl border border-[var(--color-border)]
              bg-[var(--color-surface)]
              px-4 text-sm text-[var(--color-text)]
              placeholder:text-[var(--color-text-muted)]
              transition
              focus:border-[var(--color-accent)]
              focus:outline-none
              disabled:opacity-50
            "
          />

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="
              h-11 whitespace-nowrap rounded-xl
              bg-[var(--color-accent)]
              px-5 text-sm font-medium text-white
              transition hover:opacity-90
              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving ? "در حال افزودن..." : "+ افزودن"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 text-sm leading-6 text-red-500"
          >
            {error}
          </p>
        )}
      </div>

      {/* خطای دریافت دسته‌بندی‌ها */}
      {loadError && (
        <div
          role="alert"
          className="
            mb-4 flex flex-wrap items-center justify-between
            gap-3 rounded-xl border border-red-500/20
            bg-red-500/10 p-4 text-sm text-red-500
          "
        >
          <span>{loadError}</span>

          <button
            type="button"
            onClick={handleRetry}
            disabled={loading}
            className="
              rounded-lg border border-red-500/30
              px-3 py-2 transition hover:bg-red-500/10
              disabled:cursor-not-allowed disabled:opacity-50
            "
          >
            {loading ? "در حال دریافت..." : "تلاش مجدد"}
          </button>
        </div>
      )}

      {/* فهرست دسته‌بندی‌ها */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="
                h-14 rounded-xl
                bg-[var(--color-surface-2)]
                animate-pulse
              "
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {categories.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              {loadError
                ? "دریافت دسته‌بندی‌ها ناموفق بود."
                : "دسته‌بندی‌ای ثبت نشده"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-5 py-4 text-right font-semibold">
                      عنوان
                    </th>

                    <th className="px-5 py-4 text-left font-semibold">
                      عملیات
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--color-border)]">
                  {categories.map((category) => (
                    <tr
                      key={category.id}
                      className="
                        transition
                        hover:bg-[var(--color-surface-2)]
                      "
                    >
                      <td className="px-5 py-4 font-medium text-[var(--color-text)]">
                        {category.title}
                      </td>

                      <td className="px-4 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleDelete(category)}
                          disabled={deletingId !== null}
                          className="
                            h-9 rounded-xl bg-red-500/10
                            px-4 text-xs font-medium text-red-500
                            transition hover:bg-red-500/20
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                          "
                        >
                          {deletingId === category.id
                            ? "در حال حذف..."
                            : "حذف"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
