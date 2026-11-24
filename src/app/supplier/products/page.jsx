
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
  basePrice: "",
  discount: "0",
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

function ImageGuide() {
  return (
    <aside className="h-fit rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-xl">
          📸
        </span>

        <div>
          <h4 className="font-bold text-[var(--color-text)]">
            راهنمای عکاسی محصول
          </h4>

          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            برای نمایش بهتر کالا در فروشگاه برجک
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
        لطفاً هنگام عکاسی از محصول، تا حد امکان نکات زیر را رعایت کنید:
      </p>

      <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--color-text)]">
        <li className="flex items-start gap-2">
          <span className="mt-1 text-emerald-600">✓</span>
          <span>
            در محیطی روشن و با نور مناسب عکس بگیرید تا تصویر واضح و بدون سایه‌های شدید باشد.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="mt-1 text-emerald-600">✓</span>
          <span>
            ترجیحاً از پس‌زمینه سفید یا ساده استفاده کنید.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="mt-1 text-emerald-600">✓</span>
          <span>
            کل محصول باید در تصویر دیده شود و بخشی از آن از کادر خارج نباشد.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="mt-1 text-emerald-600">✓</span>
          <span>
            از چند زاویه مختلف، جزئیات محصول و محتویات جعبه عکس بگیرید.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="mt-1 text-emerald-600">✓</span>
          <span>
            از تصاویر واقعی، واضح و باکیفیت محصولی که عرضه می‌کنید استفاده کنید.
          </span>
        </li>

        <li className="flex items-start gap-2">
          <span className="mt-1 text-red-500">×</span>
          <span>
            از تصاویر تار، اسکرین‌شات، عکس‌های بی‌کیفیت و تصاویر دارای واترمارک یا نوشته تبلیغاتی استفاده نکنید.
          </span>
        </li>
      </ul>

      <div className="mt-4 space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            حداقل ابعاد تصویر
          </p>

          <p className="mt-1 font-bold text-[var(--color-text)]" dir="ltr">
            500 × 500 px
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            ابعاد پیشنهادی
          </p>

          <p className="mt-1 font-bold text-[var(--color-accent)]" dir="ltr">
            1500 × 1500 px
          </p>
        </div>

        <div>
          <p className="mt-1 font-bold text-[var(--color-text)]">
            JPG، PNG، WebP و AVIF: حداکثر ۱۵ مگابایت
          </p>
          <p className="mt-1 font-bold text-[var(--color-accent)]">
            HEIC و HEIF آیفون: حداکثر ۲۵ مگابایت
          </p>
        </div>

        <div>
          <p className="text-xs text-[var(--color-text-muted)]">
            فرمت‌های قابل قبول
          </p>
          <p className="mt-1 font-bold text-[var(--color-text)]">
            JPG، PNG، WebP و AVIF
          </p>
          <p className="mt-1 text-xs text-[var(--color-accent)]">
            HEIC و HEIF مخصوص عکس‌های آیفون
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
        <div className="flex items-start gap-2">
          <span className="text-emerald-600">✦</span>

          <p className="text-xs leading-6 text-[var(--color-text)]">
            نیازی به تغییر دستی اندازه عکس قبل از بارگذاری نیست.
            تصاویر پس از دریافت، به‌صورت خودکار توسط سیستم برجک
            بهینه‌سازی و برای نمایش در موبایل و کامپیوتر آماده می‌شوند.
          </p>
        </div>
      </div>
    </aside>
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

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  const [editConfirmProduct, setEditConfirmProduct] =
    useState(null);
  const [editLoading, setEditLoading] = useState(false);

  const [stockEditProduct, setStockEditProduct] =
    useState(null);
  const [stockEditValue, setStockEditValue] = useState("");
  const [stockEditError, setStockEditError] = useState("");
  const [stockSubmitting, setStockSubmitting] = useState(false);

  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] =
    useState(true);

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

  const handleStatusChange = (nextStatus) => {
    if (status === nextStatus) return;

    setLoading(true);
    setError("");
    setNotice("");
    setStatus(nextStatus);
    setPage(1);
  };

  const handlePageChange = (nextPage) => {
    if (page === nextPage) return;

    setLoading(true);
    setError("");
    setPage(nextPage);
  };

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      setFormError("");
      setEditingProductId(null);
      return;
    }

    setForm({
      ...EMPTY_FORM,
      categoryId: categories[0]?.id
        ? String(categories[0].id)
        : "",
    });

    setEditingProductId(null);
    setFormError("");
    setNotice("");
    setShowForm(true);
  };

  const requestProductEdit = (product) => {
    if (product.deletedAt) return;

    setStockEditProduct(null);
    setEditConfirmProduct(product);
    setFormError("");
    setError("");
  };

  const confirmProductEdit = async () => {
    if (!editConfirmProduct || editLoading) return;

    const productId = editConfirmProduct.id;

    setEditLoading(true);
    setError("");
    setNotice("");
    setFormError("");

    try {
      const res = await fetch(
        `/api/supplier/products/${productId}`,
        {
          cache: "no-store",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.product) {
        throw new Error(
          data.error || "دریافت اطلاعات محصول ناموفق بود"
        );
      }

      const product = data.product;

      const imageUrls = Array.isArray(product.images)
        ? product.images
          .map((item) =>
            typeof item === "string" ? item : item.url
          )
          .filter(Boolean)
        : [];

      const gallery = [
        ...new Set([
          product.image,
          ...imageUrls,
        ].filter(Boolean)),
      ].slice(0, 5);

      setForm({
        title: product.title || "",
        basePrice: String(product.basePrice ?? ""),
        discount: String(product.discount ?? 0),
        categoryId: String(product.categoryId ?? ""),
        image: product.image || gallery[0] || "",
        gallery,
        description: product.description || "",
        stock: String(product.stock ?? 0),
        specs: (product.specs || []).map((spec) => ({
          key: spec.key || "",
          value: String(spec.value ?? ""),
        })),
      });

      setEditingProductId(productId);
      setEditConfirmProduct(null);
      setShowForm(true);
      setFormError("");
    } catch (err) {
      console.error("LOAD SUPPLIER PRODUCT FOR EDIT ERROR:", err);

      setError(
        err.message || "خطا در دریافت اطلاعات محصول"
      );

      setEditConfirmProduct(null);
    } finally {
      setEditLoading(false);
    }
  };

  const openStockEditor = (product) => {
    if (product.deletedAt) return;

    setEditConfirmProduct(null);
    setStockEditProduct(product);
    setStockEditValue(String(product.stock ?? 0));
    setStockEditError("");
  };

  const saveStockOnly = async () => {
    if (!stockEditProduct || stockSubmitting) return;

    const stock = Number(stockEditValue);
    const reservedStock =
      Number(stockEditProduct.reservedStock) || 0;

    if (!Number.isSafeInteger(stock) || stock < 0) {
      setStockEditError("موجودی باید عدد صحیح و غیرمنفی باشد.");
      return;
    }

    if (stock < reservedStock) {
      setStockEditError(
        `موجودی نمی‌تواند کمتر از ${reservedStock.toLocaleString("fa-IR")} عدد رزروشده باشد.`
      );
      return;
    }

    setStockSubmitting(true);
    setStockEditError("");

    try {
      const res = await fetch(
        `/api/supplier/products/${stockEditProduct.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ stock }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "ویرایش موجودی انجام نشد."
        );
      }

      setStockEditProduct(null);
      setStockEditValue("");
      setStockEditError("");

      setNotice(
        "موجودی محصول با موفقیت به‌روزرسانی شد."
      );

      setLoading(true);
      setError("");
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("UPDATE PRODUCT STOCK ERROR:", err);

      setStockEditError(
        err.message || "خطا در ارتباط با سرور"
      );
    } finally {
      setStockSubmitting(false);
    }
  };

  const discountNumber =
    form.discount.trim() === ""
      ? 0
      : Number(form.discount);

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

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting || galleryUploading) return;

    setFormError("");

    const title = form.title.trim();
    const description = form.description.trim();

    const basePrice = Number(form.basePrice);
    const discount =
      form.discount.trim() === ""
        ? 0
        : Number(form.discount);

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

    if (!Number.isSafeInteger(basePrice) || basePrice <= 0) {
      setFormError("قیمت پایه باید یک عدد صحیح و مثبت باشد.");
      return;
    }

    if (
      !Number.isSafeInteger(discount) ||
      discount < 0 ||
      discount > 99
    ) {
      setFormError("درصد تخفیف باید عددی بین صفر تا ۹۹ باشد.");
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
      basePrice,
      discount,
      categoryId,
      image: mainImage,
      gallery,
      description,
      stock,
      specs,
    };

    const isEditing = Boolean(editingProductId);

    setSubmitting(true);

    try {
      const res = await fetch(
        isEditing
          ? `/api/supplier/products/${editingProductId}`
          : "/api/supplier/products",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          data.error || "ذخیره محصول انجام نشد."
        );
        return;
      }

      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormError("");
      setEditingProductId(null);

      setNotice(
        isEditing
          ? "تغییرات محصول ذخیره شد و برای بررسی مجدد مدیر ارسال گردید."
          : data.message ||
          "محصول ثبت شد و برای بررسی مدیر ارسال گردید."
      );

      setLoading(true);
      setError("");
      setPage(1);
      setStatus("unpublished");
      setReloadKey((prev) => prev + 1);
    } catch (err) {
      console.error("SAVE SUPPLIER PRODUCT ERROR:", err);

      setFormError("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {editConfirmProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h2
              id="edit-confirm-title"
              className="text-lg font-bold"
            >
              ویرایش محصول
            </h2>

            <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
              با ویرایش محتوای محصول «
              <strong className="text-[var(--color-text)]">
                {editConfirmProduct.title}
              </strong>
              »، پس از ذخیره تغییرات، محصول موقتاً از انتشار خارج
              و برای بررسی مجدد به مدیر ارسال می‌شود.
            </p>

            <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
              اگر محصول پیش از ویرایش منتشر بوده باشد، پس از
              تأیید مجدد مدیر دوباره منتشر خواهد شد. تغییر موجودی
              به‌تنهایی نیازی به بررسی مجدد ندارد.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={editLoading}
                onClick={() => setEditConfirmProduct(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={editLoading}
                onClick={confirmProductEdit}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {editLoading
                  ? "در حال دریافت اطلاعات..."
                  : "متوجه شدم، ادامه ویرایش"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stockEditProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="stock-edit-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-2xl">
            <h2
              id="stock-edit-title"
              className="text-lg font-bold"
            >
              ویرایش موجودی
            </h2>

            <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
              محصول: {stockEditProduct.title}
            </p>

            <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
              این عملیات فقط موجودی را تغییر می‌دهد و وضعیت
              انتشار یا بررسی محصول را تغییر نمی‌دهد.
            </p>

            <label className="mb-2 mt-4 block text-sm font-medium">
              موجودی جدید
            </label>

            <input
              type="number"
              min={Number(stockEditProduct.reservedStock) || 0}
              step="1"
              value={stockEditValue}
              onChange={(event) => {
                setStockEditValue(event.target.value);
                setStockEditError("");
              }}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />

            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              موجودی رزروشده:{" "}
              {(
                Number(stockEditProduct.reservedStock) || 0
              ).toLocaleString("fa-IR")}
            </p>

            {stockEditError && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
              >
                {stockEditError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={stockSubmitting}
                onClick={() => {
                  setStockEditProduct(null);
                  setStockEditError("");
                }}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={stockSubmitting}
                onClick={saveStockOnly}
                className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {stockSubmitting
                  ? "در حال ذخیره..."
                  : "ذخیره موجودی"}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="card flex flex-col gap-5 p-4 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-bold">
              {editingProductId
                ? "ویرایش محصول"
                : "ثبت کالای جدید"}
            </h2>

            <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
              {editingProductId
                ? "پس از ذخیره تغییرات محتوایی، محصول برای بررسی مجدد مدیر ارسال می‌شود."
                : "محصول پس از ثبت برای بررسی و تأیید مدیر ارسال می‌شود و تا زمان تأیید منتشر نخواهد شد."}
            </p>
          </div>

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

            <div>
              <label className="mb-2 block text-sm font-medium">
                قیمت پایه تأمین‌کننده (تومان) *
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={form.basePrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    basePrice: event.target.value,
                  }))
                }
                placeholder="مثلاً ۱۵۰۰۰۰۰۰"
                required
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                درصد تخفیف (اختیاری)
              </label>

              <input
                type="number"
                min="0"
                max="99"
                step="1"
                value={form.discount}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    discount: event.target.value,
                  }))
                }
                placeholder="۰ تا ۹۹"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
              />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--color-text-muted)]">
                  تخفیف انتخاب‌شده
                </span>

                <span className="font-bold text-[var(--color-text)]">
                  {Number.isFinite(discountNumber) &&
                    Number.isInteger(discountNumber) &&
                    discountNumber >= 0 &&
                    discountNumber <= 99
                    ? discountNumber.toLocaleString("fa-IR")
                    : "—"}٪
                </span>
              </div>

              <p className="mt-2 text-xs leading-6 text-[var(--color-text-muted)]">
                قیمت نهایی مشتری با محاسبه کمیسیون و گرد کردن
                توسط سیستم تعیین می‌شود. مبلغ تخفیف تأمین‌کننده
                نیز در محاسبه مبلغ دریافتی او لحاظ خواهد شد.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm font-medium">
                موجودی *
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

          {/* تصاویر محصول و راهنمای عکاسی */}
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

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              {/* گالری و آپلود */}
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-3">
                  {form.gallery.map((img, index) => (
                    <div
                      key={`${img}-${index}`}
                      className={`relative h-28 w-28 overflow-hidden rounded-xl border ${form.image === img
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
                        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
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
                  <p
                    role="status"
                    className="text-xs text-[var(--color-accent)]"
                  >
                    در حال آپلود و بهینه‌سازی تصاویر...
                  </p>
                )}

                <p className="rounded-lg bg-[var(--color-surface-2)] p-3 text-xs leading-6 text-[var(--color-text-muted)]">
                  تصاویر بارگذاری‌شده به‌صورت خودکار به فرمت WebP
                  تبدیل می‌شوند. تصویر اصلی محصول را با دقت انتخاب
                  کن؛ این تصویر در کارت‌های فروشگاه نمایش داده می‌شود.
                </p>
              </div>

              {/* راهنمای عکاسی کنار آپلود */}
              <ImageGuide />
            </div>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">
                  مشخصات فنی
                </h3>

                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  ردیف‌های خالی هنگام ذخیره محصول ثبت نمی‌شوند.
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

          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm leading-6 text-red-500"
            >
              {formError}
            </p>
          )}

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
                ? "در حال ذخیره..."
                : galleryUploading
                  ? "در حال آپلود تصاویر..."
                  : editingProductId
                    ? "ذخیره تغییرات و ارسال برای بررسی"
                    : "ثبت و ارسال برای بررسی"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() =>
              handleStatusChange(filter.value)
            }
            className={`h-9 rounded-xl border px-4 text-sm transition ${status === filter.value
              ? "btn-primary"
              : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

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
          به معنی انتشار خودکار آن نیست؛ مگر اینکه محصول پیش از
          ویرایش محتوایی منتشر بوده باشد و پس از بررسی مجدد تأیید شود.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
            <tr>
              <th className="p-3 text-right font-medium">
                کالا
              </th>

              <th className="p-3 text-right font-medium">
                دسته‌بندی
              </th>

              <th className="p-3 text-right font-medium">
                قیمت پایه (تومان)
              </th>

              <th className="p-3 text-right font-medium">
                قیمت فروش مشتری (تومان)
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

              <th className="p-3 text-right font-medium">
                عملیات
              </th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="p-6 text-center text-[var(--color-text-muted)]"
                >
                  در حال بارگذاری...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
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
                      {Number(product.basePrice).toLocaleString(
                        "fa-IR"
                      )}
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

                    <td className="p-3">
                      {!product.deletedAt && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openStockEditor(product)}
                            className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          >
                            موجودی
                          </button>

                          <button
                            type="button"
                            onClick={() => requestProductEdit(product)}
                            className="whitespace-nowrap rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                          >
                            ویرایش محتوا
                          </button>
                        </div>
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
