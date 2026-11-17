
"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/pagination";

const FILTERS = [
  { value: "all", label: "همه" },
  { value: "published", label: "منتشرشده" },
  { value: "unpublished", label: "منتشرنشده" },
  { value: "archived", label: "آرشیو" },
];

const REVIEW_STATES = {
  PENDING: {
    label: "در انتظار بررسی",
    cls: "bg-amber-500/10 text-amber-600",
  },
  APPROVED: {
    label: "تأییدشده",
    cls: "bg-emerald-500/10 text-emerald-600",
  },
  REJECTED: {
    label: "ردشده",
    cls: "bg-red-500/10 text-red-600",
  },
};

const EMPTY_FORM = {
  title: "",
  price: "",
  originalPrice: "",
  categoryId: "",
  image: "",
  gallery: [],
  description: "",
  stock: "0",
  specs: [],
};

function publicationState(product) {
  if (product.deletedAt) {
    return {
      label: "آرشیو",
      cls: "bg-zinc-500/10 text-zinc-500",
    };
  }

  if (!product.isPublished) {
    return {
      label: "منتشرنشده",
      cls: "bg-amber-500/10 text-amber-600",
    };
  }

  return {
    label: "منتشرشده",
    cls: "bg-emerald-500/10 text-emerald-600",
  };
}

function reviewState(product) {
  return (
    REVIEW_STATES[product.reviewStatus] || {
      label: "نامشخص",
      cls: "bg-zinc-500/10 text-zinc-500",
    }
  );
}

export default function SupplierProductsPage() {
  const [items, setItems] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // فرم ایجاد محصول
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // دسته‌بندی‌ها
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] =
    useState(true);

  // آپلود تصاویر
  const [galleryUploading, setGalleryUploading] =
    useState(false);

  // دریافت محصولات
  useEffect(() => {
    const controller = new AbortController();

    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: "12",
        });

        const res = await fetch(
          `/api/supplier/products?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (controller.signal.aborted) return;

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت محصولات"
          );
        }

        setItems(data.items || []);

        setPagination(
          data.pagination || {
            page: 1,
            totalPages: 1,
            total: 0,
          }
        );

        setError("");
      } catch (err) {
        if (
          err.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH SUPPLIER PRODUCTS ERROR:", err);

        setError(
          err.message || "خطا در ارتباط با سرور"
        );

        setItems([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchProducts();

    return () => {
      controller.abort();
    };
  }, [status, page, reloadKey]);

  // دریافت دسته‌بندی‌ها
  useEffect(() => {
    const controller = new AbortController();

    async function fetchCategories() {
      try {
        const res = await fetch(
          "/api/admin/categories",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (controller.signal.aborted) return;

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت دسته‌بندی‌ها"
          );
        }

        const receivedCategories = data.categories || [];

        setCategories(receivedCategories);

        setForm((prev) => ({
          ...prev,
          categoryId:
            prev.categoryId ||
            (receivedCategories[0]?.id
              ? String(receivedCategories[0].id)
              : ""),
        }));
      } catch (err) {
        if (
          err.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH CATEGORIES ERROR:", err);

        setFormError(
          err.message || "خطا در دریافت دسته‌بندی‌ها"
        );
      } finally {
        if (!controller.signal.aborted) {
          setCategoriesLoading(false);
        }
      }
    }

    fetchCategories();

    return () => controller.abort();
  }, []);

  // تغییر فیلتر
  const handleStatusChange = (nextStatus) => {
    if (status === nextStatus) return;

    setLoading(true);
    setError("");
    setNotice("");
    setStatus(nextStatus);
    setPage(1);
  };

  // تغییر صفحه
  const handlePageChange = (nextPage) => {
    if (page === nextPage) return;

    setLoading(true);
    setError("");
    setPage(nextPage);
  };

  // باز و بسته کردن فرم
  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormError("");
      return;
    }

    setForm({
      ...EMPTY_FORM,
      categoryId: categories[0]?.id
        ? String(categories[0].id)
        : "",
    });

    setFormError("");
    setNotice("");
    setShowForm(true);
  };

  // محاسبه تخفیف
  const priceNumber =
    form.price.trim() === "" ? 0 : Number(form.price);

  const originalPriceNumber =
    form.originalPrice.trim() === ""
      ? priceNumber
      : Number(form.originalPrice);

  const discount =
    originalPriceNumber > priceNumber &&
    originalPriceNumber > 0
      ? Math.min(
          100,
          Math.round(
            ((originalPriceNumber - priceNumber) /
              originalPriceNumber) *
              100
          )
        )
      : 0;

  // آپلود تصاویر
  const handleGalleryUpload = async (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    const remaining = 5 - form.gallery.length;

    if (remaining <= 0) {
      setFormError(
        "حداکثر ۵ تصویر برای هر محصول مجاز است."
      );

      input.value = "";
      return;
    }

    const filesToUpload = files.slice(0, remaining);

    if (files.length > remaining) {
      setFormError(
        `فقط می‌توانی ${remaining} تصویر دیگر اضافه کنی.`
      );
    } else {
      setFormError("");
    }

    setGalleryUploading(true);

    try {
      const uploaded = [];
      const errors = [];

      for (const file of filesToUpload) {
        const body = new FormData();
        body.append("image", file);

        try {
          const res = await fetch("/api/admin/upload", {
            method: "POST",
            body,
          });

          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            errors.push(
              data.error || `آپلود ${file.name} ناموفق بود`
            );
            continue;
          }

          if (data.url) {
            uploaded.push(data.url);
          } else {
            errors.push(`آدرس تصویر ${file.name} دریافت نشد`);
          }
        } catch {
          errors.push(`خطا در آپلود ${file.name}`);
        }
      }

      if (uploaded.length > 0) {
        setForm((prev) => {
          const gallery = [
            ...new Set([
              ...prev.gallery,
              ...uploaded,
            ]),
          ].slice(0, 5);

          return {
            ...prev,
            gallery,
            image: prev.image || gallery[0] || "",
          };
        });
      }

      if (errors.length > 0) {
        setFormError(errors.join(" | "));
      }
    } finally {
      setGalleryUploading(false);
      input.value = "";
    }
  };

  // انتخاب تصویر اصلی
  const selectMainImage = (url) => {
    setForm((prev) => ({
      ...prev,
      image: url,
      gallery: [
        url,
        ...prev.gallery.filter((item) => item !== url),
      ],
    }));
  };

  // حذف تصویر
  const removeImage = (url) => {
    setForm((prev) => {
      const gallery = prev.gallery.filter(
        (item) => item !== url
      );

      return {
        ...prev,
        gallery,
        image:
          prev.image === url
            ? gallery[0] || ""
            : prev.image,
      };
    });
  };

  // مشخصات فنی
  const updateSpec = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((spec, i) =>
        i === index
          ? {
              ...spec,
              [field]: value,
            }
          : spec
      ),
    }));
  };

  const addSpec = () => {
    setForm((prev) => ({
      ...prev,
      specs: [
        ...prev.specs,
        {
          key: "",
          value: "",
        },
      ],
    }));
  };

  const removeSpec = (index) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.filter(
        (_, i) => i !== index
      ),
    }));
  };

  // ثبت محصول جدید
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting || galleryUploading) return;

    setFormError("");

    const title = form.title.trim();
    const description = form.description.trim();

    const price = Number(form.price);

    const originalPrice =
      form.originalPrice.trim() === ""
        ? price
        : Number(form.originalPrice);

    const categoryId = Number(form.categoryId);
    const stock = Number(form.stock);

    if (!title || title.length > 200) {
      setFormError(
        "عنوان محصول الزامی است و نباید بیشتر از ۲۰۰ کاراکتر باشد."
      );
      return;
    }

    if (!description) {
      setFormError("توضیحات محصول را وارد کن.");
      return;
    }

    if (
      !Number.isSafeInteger(price) ||
      price <= 0
    ) {
      setFormError("قیمت فروش باید یک عدد صحیح و مثبت باشد.");
      return;
    }

    if (
      !Number.isSafeInteger(originalPrice) ||
      originalPrice < price
    ) {
      setFormError(
        "قیمت اصلی باید برابر یا بیشتر از قیمت فروش باشد."
      );
      return;
    }

    if (
      !Number.isSafeInteger(categoryId) ||
      categoryId <= 0 ||
      !categories.some(
        (category) => category.id === categoryId
      )
    ) {
      setFormError("یک دسته‌بندی معتبر انتخاب کن.");
      return;
    }

    if (
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      setFormError("موجودی محصول معتبر نیست.");
      return;
    }

    const mainImage = form.image.trim();

    if (!mainImage || !form.gallery.includes(mainImage)) {
      setFormError("تصویر اصلی محصول را انتخاب کن.");
      return;
    }

    if (
      form.gallery.length === 0 ||
      form.gallery.length > 5
    ) {
      setFormError("محصول باید حداقل یک تصویر داشته باشد.");
      return;
    }

    const gallery = [
      ...new Set(
        form.gallery.filter(
          (url) =>
            typeof url === "string" &&
            url.trim() &&
            url !== mainImage
        )
      ),
    ].slice(0, 4);

    const specs = form.specs
      .map((spec) => ({
        key: String(spec.key || "").trim(),
        value: String(spec.value || "").trim(),
      }))
      .filter((spec) => spec.key && spec.value);

    const payload = {
      title,
      price,
      originalPrice,
      discount,
      categoryId,
      image: mainImage,
      gallery,
      description,
      stock,
      specs,
    };

    setSubmitting(true);

    try {
      const res = await fetch("/api/supplier/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          data.error || "ثبت محصول انجام نشد."
        );
        return;
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError("");

      setNotice(
        data.message ||
          "محصول ثبت شد و برای بررسی مدیر ارسال گردید."
      );

      // محصول جدید در فیلتر منتشرنشده دیده می‌شود.
      setLoading(true);
      setError("");
      setPage(1);
      setStatus("unpublished");
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("CREATE SUPPLIER PRODUCT ERROR:", err);

      setFormError("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* عنوان و عملیات */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">
            کالاهای من
          </h1>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {pagination.total.toLocaleString("fa-IR")} کالا
          </p>
        </div>

        <button
          type="button"
          onClick={toggleForm}
          className="btn-primary rounded-xl px-4 py-2.5 text-sm transition hover:opacity-90"
        >
          {showForm ? "بستن فرم" : "+ ثبت کالای جدید"}
        </button>
      </div>

      {/* پیام موفقیت */}
      {notice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400"
        >
          {notice}
          <button
            type="button"
            onClick={() => setNotice("")}
            className="mr-3 font-bold"
            aria-label="بستن پیام"
          >
            ×
          </button>
        </div>
      )}

      {/* فرم ایجاد محصول */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card flex flex-col gap-5 p-4 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-bold">
              ثبت کالای جدید
            </h2>

            <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
              محصول پس از ثبت برای بررسی و تأیید مدیر ارسال
              می‌شود و تا زمان تأیید منتشر نخواهد شد.
            </p>
          </div>

          {/* اطلاعات پایه */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                عنوان محصول *
              </label>

              <input
                type="text"
                maxLength={200}
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="مثلاً گوشی موبایل سامسونگ"
                required
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                دسته‌بندی *
              </label>

              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                  }))
                }
                disabled={categoriesLoading}
                required
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              >
                <option value="">
                  {categoriesLoading
                    ? "در حال دریافت دسته‌بندی‌ها..."
                    : "انتخاب دسته‌بندی"}
                </option>

                {categories.map((category) => (
                  <option
                    key={category.id}
                    value={category.id}
                  >
                    {category.title}
                  </option>
                ))}
              </select>

              {!categoriesLoading &&
                categories.length === 0 && (
                  <p className="mt-2 text-xs text-red-500">
                    دسته‌بندی‌ای برای انتخاب وجود ندارد. با مدیر
                    فروشگاه تماس بگیر.
                  </p>
                )}
            </div>

            {/* قیمت */}
            <div>
              <label className="mb-2 block text-sm font-medium">
                قیمت فروش (تومان) *
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={form.price}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    price: event.target.value,
                  }))
                }
                placeholder="مثلاً ۱۵۰۰۰۰۰۰"
                required
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                قیمت اصلی (تومان)
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={form.originalPrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    originalPrice: event.target.value,
                  }))
                }
                placeholder="اختیاری؛ بدون تخفیف خالی بگذار"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  درصد تخفیف محاسبه‌شده
                </span>

                <span className="font-bold text-[var(--color-text)]">
                  {discount.toLocaleString("fa-IR")}٪
                </span>
              </div>

              {form.originalPrice.trim() !== "" &&
                originalPriceNumber < priceNumber && (
                  <p className="mt-2 text-xs text-red-500">
                    قیمت اصلی نمی‌تواند از قیمت فروش کمتر باشد.
                  </p>
                )}
            </div>

            {/* موجودی */}
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                موجودی اولیه *
              </label>

              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    stock: event.target.value,
                  }))
                }
                required
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />

              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                موجودی رزروشده توسط سیستم مدیریت می‌شود.
              </p>
            </div>
          </div>

          {/* توضیحات */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              توضیحات محصول *
            </label>

            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="توضیحات کامل محصول را وارد کن..."
              rows={5}
              required
              className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm leading-7 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>

          {/* تصاویر */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-bold">
                تصاویر محصول *
              </h3>

              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                تصویر اصلی به‌علاوه حداکثر ۴ تصویر گالری؛
                مجموعاً ۵ تصویر.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {form.gallery.map((img, index) => (
                <div
                  key={img}
                  className={`relative h-28 w-28 overflow-hidden rounded-xl border ${
                    form.image === img
                      ? "border-[var(--color-accent)]"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img}
                    alt={`تصویر محصول ${index + 1}`}
                    onClick={() => selectMainImage(img)}
                    className="h-full w-full cursor-pointer object-contain"
                  />

                  {form.image === img && (
                    <span className="absolute bottom-0 right-0 left-0 bg-[var(--color-accent)] px-1 py-1 text-center text-[10px] text-white">
                      تصویر اصلی
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => removeImage(img)}
                    aria-label="حذف تصویر"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white shadow"
                  >
                    ×
                  </button>
                </div>
              ))}

              {form.gallery.length < 5 && (
                <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition hover:border-[var(--color-accent)]">
                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    disabled={galleryUploading}
                    onChange={handleGalleryUpload}
                  />

                  {galleryUploading ? (
                    <span className="animate-spin text-2xl">
                      ↻
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl">+</span>
                      <span className="mt-1 text-xs">
                        افزودن تصویر
                      </span>
                    </>
                  )}
                </label>
              )}
            </div>

            <p className="text-xs text-[var(--color-text-muted)]">
              برای انتخاب تصویر اصلی روی آن کلیک کن.
            </p>

            {galleryUploading && (
              <p className="text-xs text-[var(--color-accent)]">
                در حال آپلود و بهینه‌سازی تصاویر...
              </p>
            )}
          </section>

          {/* مشخصات فنی */}
          <section className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  مشخصات فنی
                </h3>

                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  ردیف‌های خالی هنگام ثبت محصول ذخیره نمی‌شوند.
                </p>
              </div>

              <button
                type="button"
                onClick={addSpec}
                className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs transition hover:border-[var(--color-accent)]"
              >
                + افزودن مشخصه
              </button>
            </div>

            {form.specs.length === 0 ? (
              <p className="rounded-lg bg-[var(--color-surface-2)] p-4 text-center text-xs text-[var(--color-text-muted)]">
                هنوز مشخصه‌ای اضافه نشده است.
              </p>
            ) : (
              <div className="space-y-3">
                {form.specs.map((spec, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      value={spec.key}
                      onChange={(event) =>
                        updateSpec(
                          index,
                          "key",
                          event.target.value
                        )
                      }
                      placeholder="عنوان؛ مثلاً حافظه داخلی"
                      aria-label={`عنوان مشخصه ${index + 1}`}
                      className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                    />

                    <input
                      value={spec.value}
                      onChange={(event) =>
                        updateSpec(
                          index,
                          "value",
                          event.target.value
                        )
                      }
                      placeholder="مقدار؛ مثلاً ۲۵۶ گیگابایت"
                      aria-label={`مقدار مشخصه ${index + 1}`}
                      className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                    />

                    <button
                      type="button"
                      onClick={() => removeSpec(index)}
                      aria-label="حذف مشخصه"
                      className="h-10 rounded-lg px-3 text-sm text-red-500 transition hover:bg-red-500/10"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* خطاها */}
          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm leading-6 text-red-500"
            >
              {formError}
            </p>
          )}

          {/* عملیات فرم */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={toggleForm}
              disabled={submitting || galleryUploading}
              className="rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm transition hover:bg-[var(--color-surface-2)] disabled:opacity-50"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                galleryUploading ||
                categoriesLoading ||
                categories.length === 0
              }
              className="btn-primary rounded-xl px-6 py-3 text-sm disabled:opacity-50"
            >
              {submitting
                ? "در حال ثبت محصول..."
                : galleryUploading
                  ? "در حال آپلود تصاویر..."
                  : "ثبت و ارسال برای بررسی"}
            </button>
          </div>
        </form>
      )}

      {/* فیلترها */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() =>
              handleStatusChange(filter.value)
            }
            className={`h-9 rounded-xl border px-4 text-sm transition ${
              status === filter.value
                ? "btn-primary"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* راهنمای وضعیت‌ها */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="mb-2 text-sm font-medium">
          راهنمای وضعیت محصول
        </p>

        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(REVIEW_STATES).map(
            ([key, value]) => (
              <span
                key={key}
                className={`rounded-lg px-2.5 py-1 ${value.cls}`}
              >
                {value.label}
              </span>
            )
          )}
        </div>

        <p className="mt-2 text-xs leading-6 text-[var(--color-text-muted)]">
          وضعیت بررسی و وضعیت انتشار مستقل هستند. تأیید محصول
          به معنی انتشار خودکار آن نیست.
        </p>
      </div>

      {/* خطای دریافت محصولات */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* جدول محصولات */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3 text-right font-medium">
                کالا
              </th>

              <th className="p-3 text-right font-medium">
                دسته‌بندی
              </th>

              <th className="p-3 text-right font-medium">
                قیمت (تومان)
              </th>

              <th className="p-3 text-right font-medium">
                موجودی قابل فروش
              </th>

              <th className="p-3 text-right font-medium">
                وضعیت بررسی
              </th>

              <th className="p-3 text-right font-medium">
                وضعیت انتشار
              </th>

              <th className="p-3 text-right font-medium">
                پیام مدیریت
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-[var(--color-text-muted)]"
                >
                  در حال بارگذاری...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-[var(--color-text-muted)]"
                >
                  کالایی پیدا نشد.
                </td>
              </tr>
            ) : (
              items.map((product) => {
                const publication = publicationState(product);
                const review = reviewState(product);

                const reservedStock =
                  Number(product.reservedStock) || 0;

                const stock =
                  Number(product.stock) || 0;

                const availableStock = Math.max(
                  0,
                  stock - reservedStock
                );

                return (
                  <tr
                    key={product.id}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.image}
                          alt={product.title}
                          className="h-10 w-10 shrink-0 rounded-lg bg-[var(--color-surface-2)] object-contain"
                        />

                        <span className="max-w-48 break-words font-medium">
                          {product.title}
                        </span>
                      </div>
                    </td>

                    <td className="p-3">
                      {product.category?.title ?? "—"}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      {Number(product.price).toLocaleString(
                        "fa-IR"
                      )}
                    </td>

                    <td className="whitespace-nowrap p-3">
                      <span>
                        {availableStock.toLocaleString("fa-IR")}
                      </span>

                      {reservedStock > 0 && (
                        <span className="mr-1 text-xs text-[var(--color-text-muted)]">
                          (
                          {reservedStock.toLocaleString("fa-IR")}
                          {" "}رزرو)
                        </span>
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${review.cls}`}
                      >
                        {review.label}
                      </span>
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium ${publication.cls}`}
                      >
                        {publication.label}
                      </span>
                    </td>

                    <td className="p-3">
                      {product.reviewNote ? (
                        <div className="max-w-64 whitespace-normal rounded-lg bg-[var(--color-surface-2)] p-2 text-xs leading-6">
                          <p className="mb-1 font-semibold">
                            {product.reviewStatus === "REJECTED"
                              ? "دلیل رد محصول:"
                              : "پیام مدیریت:"}
                          </p>

                          <p className="text-[var(--color-text-muted)]">
                            {product.reviewNote}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
