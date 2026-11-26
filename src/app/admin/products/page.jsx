
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import Select from "react-select";
import {
  XMarkIcon,
  PhotoIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  PlusIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import {
  calculateProductPricing,
  PricingError,
} from "@/lib/pricing";

const MAX_PRODUCT_STOCK = 1000000;

const emptyForm = {
  title: "",
  basePrice: "",
  discount: "0",
  categoryId: "",
  image: "",
  gallery: [],
  description: "",
  supplierId: "",
  stock: "0",
  specs: [],
};

const viewLabels = {
  all: "همه محصولات",
  pending: "در انتظار بررسی",
  approved: "تأییدشده",
  rejected: "ردشده",
  archived: "آرشیوشده",
};

const reviewStatusLabels = {
  PENDING: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
};

const viewStatusMap = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
    width: "100%",
    borderRadius: 12,
    borderColor: state.isFocused
      ? "var(--color-accent)"
      : "var(--color-border)",
    backgroundColor: "var(--color-surface)",
    boxShadow: state.isFocused
      ? "0 0 0 2px var(--color-accent)"
      : "none",
    cursor: "pointer",
    transition: "border-color 150ms ease",
    "&:hover": {
      borderColor: "var(--color-accent)",
    },
  }),

  menu: (base) => ({
    ...base,
    zIndex: 100,
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid var(--color-border)",
    backgroundColor: "var(--color-surface)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
  }),

  menuList: (base) => ({
    ...base,
    padding: 5,
    backgroundColor: "var(--color-surface)",
  }),

  option: (base, state) => ({
    ...base,
    borderRadius: 8,
    marginBottom: 2,
    padding: "10px 12px",
    fontSize: 14,
    cursor: "pointer",
    color: "var(--color-text)",
    backgroundColor: state.isSelected
      ? "var(--color-accent)"
      : state.isFocused
        ? "var(--color-surface-2)"
        : "transparent",
  }),

  singleValue: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),

  placeholder: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    fontSize: 14,
  }),

  input: (base) => ({
    ...base,
    color: "var(--color-text)",
  }),

  valueContainer: (base) => ({
    ...base,
    padding: "2px 12px",
    minWidth: 0,
  }),

  indicatorsContainer: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  noOptionsMessage: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    fontSize: 13,
  }),

  loadingMessage: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),
};

function getSafeInteger(value, fallback = 0) {
  const number = Number(value);

  return Number.isSafeInteger(number) ? number : fallback;
}

/**
 * نمایش گالری تصاویر محصولات در پنل مدیریت
 */
function ProductImageGallery({ product }) {
  const [selectedImage, setSelectedImage] = useState(null);

  const rawImages = [
    product?.image,
    ...(Array.isArray(product?.images)
      ? product.images.map((item) =>
          typeof item === "string" ? item : item?.url
        )
      : []),
  ];

  const imageUrls = [
    ...new Set(
      rawImages
        .filter(
          (url) =>
            typeof url === "string" && url.trim()
        )
        .map((url) => url.trim())
    ),
  ];

  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setSelectedImage(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedImage]);

  return (
    <>
      <section className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PhotoIcon className="h-5 w-5 text-[var(--color-accent)]" />

            <h4 className="text-sm font-bold text-[var(--color-text)]">
              تصاویر محصول
            </h4>
          </div>

          <span className="rounded-lg bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]">
            {imageUrls.length.toLocaleString("fa-IR")} تصویر
          </span>
        </div>

        {imageUrls.length > 0 ? (
          <div className="grid grid-cols-2 justify-items-start gap-3 sm:grid-cols-3">
            {imageUrls.map((url, index) => (
              <button
                key={`${url}-${index}`}
                type="button"
                onClick={() => setSelectedImage(url)}
                aria-label={`مشاهده بزرگ تصویر ${index + 1} محصول ${product?.title || ""}`}
                title="برای مشاهده تصویر بزرگ‌تر کلیک کنید"
                className="group relative aspect-square w-full max-w-[180px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] transition hover:border-[var(--color-accent)] hover:shadow-md"
              >
                <Image
                  src={url}
                  alt={`${product?.title || "محصول"} - تصویر ${index + 1}`}
                  fill
                  sizes="(max-width: 640px) 45vw, 180px"
                  className="object-contain p-2"
                />

                <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                  {index === 0 ? "تصویر اصلی" : `تصویر ${index + 1}`}
                </span>

                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                  <span className="rounded-lg bg-black/50 px-3 py-2">
                    مشاهده بزرگ‌تر
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
            <PhotoIcon className="h-9 w-9" />
            <span className="text-xs">
              تصویری برای این محصول ثبت نشده است.
            </span>
          </div>
        )}

        {imageUrls.length > 0 && (
          <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
            برای بررسی جزئیات هر عکس، روی آن کلیک کن.
          </p>
        )}
      </section>

      {selectedImage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="نمایش تصویر محصول"
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6"
        >
          <button
            type="button"
            onClick={() => setSelectedImage(null)}
            aria-label="بستن تصویر"
            className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/25"
          >
            <XMarkIcon className="h-5 w-5" />
            بستن
          </button>

          <div
            className="relative h-[80vh] w-full max-w-[1200px]"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={selectedImage}
              alt={product?.title || "تصویر محصول"}
              fill
              sizes="100vw"
              priority
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * راهنمای عکاسی محصول
 */
function ProductImageGuide() {
  const tips = [
    "از نور کافی و یکنواخت استفاده کن تا جزئیات محصول واضح باشند.",
    "ترجیحاً پس‌زمینه سفید یا ساده و بدون شلوغی انتخاب کن.",
    "تمام محصول داخل کادر باشد و بخشی از آن بریده نشود.",
    "از چند زاویه مختلف و از جزئیات مهم محصول عکس بگیر.",
    "عکس باید واقعی، واضح و باکیفیت باشد؛ از تصویر اینترنتی نامرتبط استفاده نکن.",
    "از عکس تار، اسکرین‌شات، نوشته تبلیغاتی و واترمارک استفاده نکن.",
  ];

  return (
    <aside className="h-fit min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
          <PhotoIcon className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--color-text)]">
            راهنمای عکاسی محصول
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            برای نمایش بهتر محصول در فروشگاه
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tips.map((tip, index) => (
          <div
            key={index}
            className="flex min-w-0 items-start gap-2"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p className="text-xs leading-6 text-[var(--color-text-muted)]">
              {tip}
            </p>
          </div>
        ))}
      </div>

      <div className="my-4 border-t border-[var(--color-border)]" />

      <h4 className="mb-3 text-xs font-bold text-[var(--color-text)]">
        مشخصات پیشنهادی تصویر
      </h4>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[var(--color-surface)] p-3">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            حداقل ابعاد
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
            500 × 500
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            پیکسل
          </p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] p-3">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            ابعاد پیشنهادی
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
            1500 × 1500
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            پیکسل
          </p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] p-3">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            حداکثر حجم هر تصویر
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
            ۱۵ مگابایت
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-accent)]">
            HEIC و HEIF: ۲۵ مگابایت
          </p>
        </div>

        <div className="rounded-xl bg-[var(--color-surface)] p-3">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            فرمت‌های مجاز
          </p>
          <p className="mt-1 text-sm font-bold text-[var(--color-text)]">
            JPG، PNG، WebP، AVIF
          </p>
          <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
            HEIC و HEIF آیفون
          </p>
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-[var(--color-accent)]/10 p-3 text-xs leading-6 text-[var(--color-text-muted)]">
        لازم نیست عکس‌ها را قبل از آپلود تغییر اندازه بدهی. تصاویر
        در سرور به‌صورت خودکار بهینه و به فرمت WebP تبدیل می‌شوند.
        نسبت اصلی تصویر حفظ می‌شود.
      </p>
    </aside>
  );
}

export default function AdminProductsPage() {
  const { user } = useAuth();
  const { showToast, showConfirm, showPrompt } = useUI();

  const isAdmin = user?.role === "ADMIN";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [galleryUploading, setGalleryUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [view, setView] = useState("all");
  const [restoring, setRestoring] = useState(null);

  const [transferringOwnership, setTransferringOwnership] =
    useState(false);

  const [moderatingProductId, setModeratingProductId] =
    useState(null);

  // دریافت محصولات
  useEffect(() => {
    const controller = new AbortController();

    async function fetchProducts() {
      setLoading(true);

      try {
        const params = new URLSearchParams();

        if (view === "archived") {
          params.set("archived", "true");
        } else if (viewStatusMap[view]) {
          params.set("reviewStatus", viewStatusMap[view]);
        }

        const query = params.toString();

        const res = await fetch(
          `/api/admin/products${query ? `?${query}` : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت محصولات"
          );
        }

        if (!controller.signal.aborted) {
          setProducts(data.products || []);
          setListError("");
        }
      } catch (error) {
        if (
          error.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH PRODUCTS ERROR:", error);

        setListError(
          error.message || "خطا در ارتباط با سرور"
        );

        setProducts([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProducts();

    return () => controller.abort();
  }, [view]);

  // دریافت دسته‌بندی‌ها و تأمین‌کنندگان
  useEffect(() => {
    if (!showForm || !isAdmin) return;

    const controller = new AbortController();

    async function fetchCategories() {
      try {
        const res = await fetch("/api/admin/categories", {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت دسته‌بندی‌ها"
          );
        }

        if (controller.signal.aborted) return;

        const receivedCategories = data.categories || [];

        setCategories(receivedCategories);

        if (receivedCategories.length > 0) {
          setForm((prev) => ({
            ...prev,
            categoryId:
              prev.categoryId || receivedCategories[0].id,
          }));
        }
      } catch (error) {
        if (
          error.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH CATEGORIES ERROR:", error);

        setFormError(
          error.message || "خطا در دریافت دسته‌بندی‌ها"
        );
      }
    }

    async function fetchSuppliers() {
      try {
        const res = await fetch(
          "/api/admin/users?role=supplier",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت تأمین‌کنندگان"
          );
        }

        if (!controller.signal.aborted) {
          setSuppliers(data.users || []);
        }
      } catch (error) {
        if (
          error.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH SUPPLIERS ERROR:", error);

        setFormError(
          error.message || "خطا در دریافت تأمین‌کنندگان"
        );
      }
    }

    fetchCategories();
    fetchSuppliers();

    return () => controller.abort();
  }, [showForm, isAdmin]);

  // تغییر تب
  const handleViewChange = (nextView) => {
    if (view === nextView) return;

    setShowForm(false);
    setEditingProduct(null);
    setLoading(true);
    setListError("");
    setView(nextView);
  };

  // بررسی باقی‌ماندن محصول در فهرست فعلی
  const keepProductInCurrentView = (product) => {
    if (view === "archived") {
      return Boolean(product.deletedAt);
    }

    if (product.deletedAt) {
      return false;
    }

    const expectedStatus = viewStatusMap[view];

    return (
      !expectedStatus ||
      product.reviewStatus === expectedStatus
    );
  };

  // آرشیو محصول
  const archiveProduct = async (id) => {
    if (!isAdmin) return;

    const confirmed = await showConfirm({
      title: "آرشیو محصول",
      description:
        "این محصول از فروشگاه مخفی و به بخش محصولات آرشیوشده منتقل شود؟",
      confirmText: "آرشیو محصول",
      cancelText: "انصراف",
      danger: true,
    });

    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/admin/products/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(
          data.error || "آرشیو محصول ناموفق بود",
          { type: "error" }
        );
        return;
      }

      setProducts((prev) =>
        prev.filter((product) => product.id !== id)
      );

      showToast(
        data.message || "محصول با موفقیت آرشیو شد",
        { type: "success" }
      );
    } catch (error) {
      console.error("ARCHIVE PRODUCT ERROR:", error);

      showToast("خطا در ارتباط با سرور", {
        type: "error",
      });
    }
  };

  // بازگردانی محصول آرشیوشده
  const restoreProduct = async (id) => {
    if (!isAdmin || restoring !== null) return;

    const confirmed = await showConfirm({
      title: "بازگردانی محصول",
      description: "این محصول از آرشیو خارج شود؟",
      confirmText: "بازگردانی",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    setRestoring(id);

    try {
      const res = await fetch(
        `/api/admin/products/${id}/restore`,
        {
          method: "POST",
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(
          data.error || "بازگردانی محصول ناموفق بود",
          { type: "error" }
        );
        return;
      }

      setProducts((prev) =>
        prev.filter((product) => product.id !== id)
      );

      showToast("محصول با موفقیت بازگردانی شد", {
        type: "success",
      });
    } catch (error) {
      console.error("RESTORE PRODUCT ERROR:", error);

      showToast("خطا در ارتباط با سرور", {
        type: "error",
      });
    } finally {
      setRestoring(null);
    }
  };

  // تأیید یا رد محصول
  const updateProductReview = async (product, reviewStatus) => {
    if (!isAdmin || moderatingProductId !== null) {
      return;
    }

    let reviewNote = null;

    if (reviewStatus === "REJECTED") {
      const reason = await showPrompt({
        title: "رد محصول",
        description:
          "دلیل رد محصول را وارد کنید. این پیام برای بررسی و پیگیری وضعیت محصول استفاده می‌شود.",
        placeholder: "دلیل رد محصول...",
        confirmText: "ثبت دلیل",
        cancelText: "انصراف",
        required: true,
        multiline: true,
      });

      if (reason === null) return;

      reviewNote = reason.trim();

      if (!reviewNote) {
        showToast(
          "برای رد محصول، ثبت دلیل الزامی است.",
          { type: "warning" }
        );
        return;
      }

      if (reviewNote.length > 1000) {
        showToast(
          "دلیل رد نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.",
          { type: "warning" }
        );
        return;
      }
    }

    setModeratingProductId(product.id);

    try {
      const res = await fetch(
        `/api/admin/products/${product.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewStatus,
            reviewNote,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(
          data.error || "تغییر وضعیت بررسی ناموفق بود",
          { type: "error" }
        );
        return;
      }

      setProducts((prev) =>
        prev
          .map((item) =>
            item.id === product.id
              ? {
                  ...item,
                  ...data.product,
                }
              : item
          )
          .filter(keepProductInCurrentView)
      );

      showToast(
        data.message || "وضعیت بررسی محصول تغییر کرد",
        { type: "success" }
      );
    } catch (error) {
      console.error("PRODUCT REVIEW ERROR:", error);

      showToast("خطا در ارتباط با سرور", {
        type: "error",
      });
    } finally {
      setModeratingProductId(null);
    }
  };

  // انتشار یا خارج‌کردن محصول از انتشار
  const toggleProductPublication = async (product) => {
    if (!isAdmin || moderatingProductId !== null) {
      return;
    }

    const nextPublished = !product.isPublished;

    if (
      nextPublished &&
      product.reviewStatus !== "APPROVED"
    ) {
      showToast(
        "ابتدا باید محصول توسط ادمین تأیید شود.",
        { type: "warning" }
      );
      return;
    }

    let reviewNote = null;

    if (!nextPublished) {
      const reason = await showPrompt({
        title: "خارج‌کردن محصول از انتشار",
        description:
          "پیام یا دلیل خارج‌کردن محصول از انتشار را وارد کنید.",
        placeholder: "دلیل خارج‌کردن از انتشار...",
        confirmText: "ثبت پیام",
        cancelText: "انصراف",
        required: true,
        multiline: true,
      });

      if (reason === null) return;

      reviewNote = reason.trim();

      if (!reviewNote) {
        showToast(
          "ثبت پیام برای خارج‌کردن محصول از انتشار الزامی است.",
          { type: "warning" }
        );
        return;
      }

      if (reviewNote.length > 1000) {
        showToast(
          "پیام نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.",
          { type: "warning" }
        );
        return;
      }
    }

    setModeratingProductId(product.id);

    try {
      const res = await fetch(
        `/api/admin/products/${product.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            nextPublished
              ? { isPublished: true }
              : {
                  isPublished: false,
                  reviewNote,
                }
          ),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(
          data.error || "تغییر وضعیت انتشار ناموفق بود",
          { type: "error" }
        );
        return;
      }

      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                isPublished: data.isPublished,
                reviewNote: data.reviewNote,
              }
            : item
        )
      );

      showToast(
        data.message || "وضعیت انتشار تغییر کرد",
        { type: "success" }
      );
    } catch (error) {
      console.error("PRODUCT PUBLICATION ERROR:", error);

      showToast("خطا در ارتباط با سرور", {
        type: "error",
      });
    } finally {
      setModeratingProductId(null);
    }
  };

  // پیش‌نمایش قیمت‌گذاری
  const hasBasePriceInput =
    form.basePrice !== "" && form.basePrice !== null;

  const previewBasePrice = hasBasePriceInput
    ? Number(form.basePrice)
    : null;

  const previewDiscount =
    form.discount === "" ? NaN : Number(form.discount);

  const isLegacyProductWithoutBasePrice =
    Boolean(editingProduct && editingProduct.basePrice == null);

  const preserveLegacyPricing =
    isLegacyProductWithoutBasePrice && !hasBasePriceInput;

  let pricingPreview = null;
  let pricingPreviewError = "";

  if (hasBasePriceInput) {
    if (
      !Number.isSafeInteger(previewBasePrice) ||
      previewBasePrice <= 0
    ) {
      pricingPreviewError = "قیمت پایه باید عددی صحیح و مثبت باشد.";
    } else if (
      !Number.isSafeInteger(previewDiscount) ||
      previewDiscount < 0 ||
      previewDiscount > 99
    ) {
      pricingPreviewError =
        "درصد تخفیف باید عددی صحیح بین صفر تا ۹۹ باشد.";
    } else {
      try {
        pricingPreview = calculateProductPricing({
          basePrice: previewBasePrice,
          discount: previewDiscount,
        });
      } catch (error) {
        pricingPreviewError =
          error instanceof PricingError
            ? error.message
            : "محاسبه قیمت محصول با خطا مواجه شد.";
      }
    }
  }

  // انتقال مالکیت محصول
  const handleTransferOwnership = async () => {
    if (
      !isAdmin ||
      !editingProduct ||
      transferringOwnership
    ) {
      return;
    }

    const currentSupplierId =
      editingProduct.supplierId || "";

    const nextSupplierId =
      form.supplierId || "";

    if (currentSupplierId === nextSupplierId) {
      setFormError("مالک محصول تغییری نکرده است.");
      return;
    }

    const targetSupplier =
      suppliers.find(
        (supplier) => supplier.id === nextSupplierId
      ) || null;

    const targetName =
      targetSupplier?.name || "برجک";

    const confirmed = await showConfirm({
      title: "تغییر مالکیت محصول",
      description:
        `مالکیت این محصول به «${targetName}» منتقل شود؟`,
      confirmText: "انتقال مالکیت",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    setFormError("");

    try {
      setTransferringOwnership(true);

      const res = await fetch(
        `/api/admin/products/${editingProduct.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplierId: nextSupplierId || null,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          data.error || "تغییر مالکیت انجام نشد"
        );
        return;
      }

      const updated = data.product;

      setEditingProduct((prev) => ({
        ...prev,
        ...updated,
        supplier: targetSupplier,
      }));

      setForm((prev) => ({
        ...prev,
        supplierId: updated.supplierId || "",
      }));

      setProducts((prev) =>
        prev.map((product) =>
          product.id === editingProduct.id
            ? {
                ...product,
                ...updated,
                supplier: targetSupplier,
              }
            : product
        )
      );

      setFormError("");

      showToast(
        data.message ||
          "مالکیت محصول با موفقیت تغییر کرد.",
        { type: "success" }
      );
    } catch (error) {
      console.error("TRANSFER OWNERSHIP ERROR:", error);

      setFormError("خطا در ارتباط با سرور");
    } finally {
      setTransferringOwnership(false);
    }
  };

  // ایجاد یا ویرایش محصول
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!isAdmin || submitting) return;

    setFormError("");

    const method = editingProduct ? "PATCH" : "POST";

    const url = editingProduct
      ? `/api/admin/products/${editingProduct.id}`
      : "/api/admin/products";

    const galleryImages = [
      ...new Set(
        (form.gallery || []).filter(
          (imageUrl) =>
            typeof imageUrl === "string" &&
            imageUrl.trim()
        )
      ),
    ];

    const mainImage =
      typeof form.image === "string"
        ? form.image.trim()
        : "";

    const additionalGallery = galleryImages
      .filter((imageUrl) => imageUrl !== mainImage)
      .slice(0, 4);

    const cleanSpecs = (form.specs || [])
      .map((spec) => ({
        key: String(spec.key || "").trim(),
        value: String(spec.value || "").trim(),
      }))
      .filter((spec) => spec.key && spec.value);

    const basePriceWasEntered =
      form.basePrice !== "" && form.basePrice !== null;

    const shouldPreserveLegacyPricing =
      Boolean(editingProduct && editingProduct.basePrice == null) &&
      !basePriceWasEntered;

    const requestedBasePrice = basePriceWasEntered
      ? Number(form.basePrice)
      : null;

    const requestedDiscount =
      form.discount === "" ? NaN : Number(form.discount);

    const requestedStock =
      form.stock === "" ? NaN : Number(form.stock);

    const reservedStock = getSafeInteger(
      editingProduct?.reservedStock,
      0
    );

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.categoryId ||
      !mainImage ||
      !galleryImages.includes(mainImage) ||
      galleryImages.length === 0 ||
      galleryImages.length > 5
    ) {
      setFormError(
        "عنوان، توضیحات، دسته‌بندی و تصاویر محصول را به‌درستی وارد کنید."
      );
      return;
    }

    // قیمت‌گذاری
    if (!shouldPreserveLegacyPricing) {
      if (
        !Number.isSafeInteger(requestedBasePrice) ||
        requestedBasePrice <= 0
      ) {
        setFormError("قیمت پایه باید عددی صحیح و مثبت باشد.");
        return;
      }

      if (
        !Number.isSafeInteger(requestedDiscount) ||
        requestedDiscount < 0 ||
        requestedDiscount > 99
      ) {
        setFormError(
          "درصد تخفیف باید عددی صحیح بین صفر و ۹۹ باشد."
        );
        return;
      }

      try {
        calculateProductPricing({
          basePrice: requestedBasePrice,
          discount: requestedDiscount,
        });
      } catch (error) {
        setFormError(
          error instanceof PricingError
            ? error.message
            : "محاسبه قیمت محصول با خطا مواجه شد."
        );
        return;
      }
    }

    // اعتبارسنجی موجودی
    if (
      !Number.isSafeInteger(requestedStock) ||
      requestedStock < 0 ||
      requestedStock > MAX_PRODUCT_STOCK
    ) {
      setFormError(
        `موجودی باید عددی صحیح بین صفر و ${MAX_PRODUCT_STOCK.toLocaleString("fa-IR")} باشد.`
      );
      return;
    }

    if (requestedStock < reservedStock) {
      setFormError(
        `موجودی کل نمی‌تواند کمتر از ${reservedStock.toLocaleString("fa-IR")} کالای رزروشده باشد.`
      );
      return;
    }

    const payload = {
      title: form.title.trim(),
      categoryId: Number(form.categoryId),
      image: mainImage,
      gallery: additionalGallery,
      description: form.description.trim(),
      stock: requestedStock,
      specs: cleanSpecs,

      ...(editingProduct
        ? {}
        : {
            supplierId: form.supplierId || null,
          }),
    };

    if (!shouldPreserveLegacyPricing) {
      payload.basePrice = requestedBasePrice;
      payload.discount = requestedDiscount;
    }

    setSubmitting(true);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setFormError(
          data.error || "خطا در ذخیره محصول"
        );
        return;
      }

      if (editingProduct) {
        setProducts((prev) =>
          prev.map((product) =>
            product.id === data.product.id
              ? {
                  ...product,
                  ...data.product,
                }
              : product
          )
        );
      } else if (
        view === "all" ||
        view === "approved"
      ) {
        setProducts((prev) => [
          data.product,
          ...prev,
        ]);
      }

      setEditingProduct(null);

      setForm({
        ...emptyForm,
        categoryId: categories[0]?.id ?? "",
      });

      setFormError("");
      setShowForm(false);

      showToast(
        editingProduct
          ? "تغییرات محصول با موفقیت ذخیره شد."
          : "محصول با موفقیت ثبت شد.",
        { type: "success" }
      );
    } catch (error) {
      console.error("SAVE PRODUCT ERROR:", error);

      setFormError("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = categories.map((category) => ({
    value: category.id,
    label: category.title,
  }));

  // انصراف از ایجاد یا ویرایش
  const cancelEdit = () => {
    setEditingProduct(null);

    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? "",
    });

    setFormError("");
    setShowForm(false);
  };

  // بارگذاری تصاویر
  const handleGalleryUpload = async (event) => {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);

    if (!files.length) return;

    const remaining = 5 - form.gallery.length;

    if (remaining <= 0) {
      setFormError(
        "حداکثر ۵ عکس برای هر محصول مجاز است."
      );
      input.value = "";
      return;
    }

    if (files.length > remaining) {
      setFormError(
        `فقط می‌توانی ${remaining} عکس دیگر اضافه کنی.`
      );
    } else {
      setFormError("");
    }

    const filesToUpload = files.slice(0, remaining);

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
          }
        } catch {
          errors.push(`خطا در آپلود ${file.name}`);
        }
      }

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

      if (errors.length > 0) {
        setFormError(errors.join(" | "));
      } else if (uploaded.length > 0) {
        showToast(
          `${uploaded.length.toLocaleString("fa-IR")} تصویر با موفقیت بارگذاری شد.`,
          { type: "success" }
        );
      }
    } finally {
      setGalleryUploading(false);
      input.value = "";
    }
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

  // آماده‌سازی فرم ویرایش
  const startEditing = (product) => {
    const existingImages = [
      ...new Set(
        (product.images || [])
          .map((item) =>
            typeof item === "string"
              ? item
              : item.url
          )
          .filter(Boolean)
      ),
    ];

    const mainImage =
      product.image || existingImages[0] || "";

    const gallery = [
      mainImage,
      ...existingImages.filter(
        (url) => url !== mainImage
      ),
    ]
      .filter(Boolean)
      .slice(0, 5);

    setEditingProduct(product);

    setForm({
      title: product.title || "",
      basePrice:
        product.basePrice == null
          ? ""
          : String(product.basePrice),
      discount: String(product.discount ?? 0),
      categoryId:
        product.categoryId ??
        product.category?.id ??
        "",
      image: mainImage,
      gallery,
      description: product.description || "",
      supplierId: product.supplierId || "",
      stock: String(product.stock ?? 0),
      specs: Array.isArray(product.specs)
        ? product.specs.map((spec) => ({
            key: spec.key || "",
            value: spec.value || "",
          }))
        : [],
    });

    setFormError("");
    setShowForm(true);
  };

  const supplierExists = suppliers.some(
    (supplier) => supplier.id === form.supplierId
  );

  // مقادیر موجودی در فرم
  const formStockValue =
    form.stock === "" ? NaN : Number(form.stock);

  const formReservedStock = getSafeInteger(
    editingProduct?.reservedStock,
    0
  );

  const formStockValid =
    Number.isSafeInteger(formStockValue) &&
    formStockValue >= 0 &&
    formStockValue <= MAX_PRODUCT_STOCK;

  const formAvailableStock =
    formStockValid
      ? Math.max(0, formStockValue - formReservedStock)
      : 0;

  return (
    <div className="w-full min-w-0 space-y-5 overflow-x-hidden sm:space-y-6">
      {/* عنوان و فیلترها */}
      <section className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-lg font-bold sm:text-xl">
              {viewLabels[view]}
            </h1>

            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {products.length.toLocaleString("fa-IR")} محصول در این فهرست
            </p>
          </div>

          {isAdmin && view !== "archived" && (
            <button
              type="button"
              onClick={() => {
                if (showForm) {
                  cancelEdit();
                } else {
                  setEditingProduct(null);

                  setForm({
                    ...emptyForm,
                    categoryId: categories[0]?.id ?? "",
                  });

                  setFormError("");
                  setShowForm(true);
                }
              }}
              className="btn-primary w-full rounded-xl px-5 py-2.5 text-sm sm:w-auto"
            >
              {showForm ? "بستن فرم" : "+ محصول جدید"}
            </button>
          )}
        </div>

        {/* تب‌ها */}
        <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto border-b border-[var(--color-border)] pb-3">
          {Object.entries(viewLabels).map(
            ([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => handleViewChange(value)}
                className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-medium transition sm:text-sm ${
                  view === value
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </section>

      {/* فرم ایجاد و ویرایش */}
      {isAdmin && showForm && (
        <form
          onSubmit={handleSubmit}
          className="card flex min-w-0 flex-col gap-5 overflow-hidden p-3 sm:p-5 lg:p-6"
        >
          <h2 className="text-base font-bold sm:text-lg">
            {editingProduct
              ? "ویرایش محصول"
              : "ثبت محصول جدید"}
          </h2>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            {/* عنوان */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium">
                عنوان محصول
              </label>

              <input
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
                placeholder="عنوان محصول"
                className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] sm:px-4"
              />
            </div>

            {/* دسته‌بندی */}
            <div className="min-w-0">
              <label className="mb-2 block text-sm font-medium">
                دسته‌بندی
              </label>

              <Select
                styles={selectStyles}
                options={categoryOptions}
                value={
                  categoryOptions.find(
                    (item) =>
                      String(item.value) ===
                      String(form.categoryId)
                  ) || null
                }
                onChange={(selected) =>
                  setForm((prev) => ({
                    ...prev,
                    categoryId: selected?.value ?? "",
                  }))
                }
                placeholder="انتخاب دسته‌بندی"
                noOptionsMessage={() =>
                  "دسته‌بندی‌ای یافت نشد"
                }
                isSearchable
                isClearable
                className="min-w-0 text-sm"
                classNamePrefix="react-select"
              />
            </div>

            {/* مالک محصول */}
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <label
                htmlFor="product-owner"
                className="block text-sm font-medium"
              >
                مالک محصول
              </label>

              <select
                id="product-owner"
                value={form.supplierId || ""}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    supplierId: event.target.value,
                  }))
                }
                className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] sm:px-4"
              >
                <option value="">
                  برجک (محصول متعلق به فروشگاه)
                </option>

                {form.supplierId && !supplierExists && (
                  <option value={form.supplierId}>
                    مالک فعلی (در فهرست تأمین‌کنندگان نیست)
                  </option>
                )}

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.name} -{" "}
                    {supplier.isActive ? "فعال" : "غیرفعال"}
                  </option>
                ))}
              </select>

              {editingProduct ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-6 text-[var(--color-text-muted)]">
                    برای انتقال مالکیت، دکمه زیر را بزن.
                  </p>

                  <button
                    type="button"
                    disabled={transferringOwnership}
                    onClick={handleTransferOwnership}
                    className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm transition hover:bg-[var(--color-surface-2)] disabled:opacity-50 sm:w-auto"
                  >
                    {transferringOwnership
                      ? "در حال انتقال..."
                      : "تغییر مالکیت محصول"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  محصول جدید به مالک انتخاب‌شده تعلق خواهد داشت.
                </p>
              )}
            </div>

            {/* قیمت پایه */}
            <div className="min-w-0">
              <label
                htmlFor="product-base-price"
                className="mb-2 block text-sm font-medium"
              >
                قیمت پایه (تومان)
              </label>

              <input
                id="product-base-price"
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={form.basePrice}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    basePrice: event.target.value,
                  }))
                }
                placeholder="قیمت اعلامی فروشنده / قیمت تأمین"
                className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] sm:px-4"
              />

              <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                قیمت نهایی و درصد سود به‌صورت خودکار در سرور محاسبه می‌شوند.
              </p>
            </div>

            {/* تخفیف */}
            <div className="min-w-0">
              <label
                htmlFor="product-discount"
                className="mb-2 block text-sm font-medium"
              >
                درصد تخفیف از قیمت پایه (۰ تا ۹۹)
              </label>

              <input
                id="product-discount"
                type="number"
                min="0"
                max="99"
                step="1"
                value={form.discount}
                disabled={
                  Boolean(
                    editingProduct &&
                    editingProduct.basePrice == null
                  ) && !hasBasePriceInput
                }
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    discount: event.target.value,
                  }))
                }
                className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
              />

              {isLegacyProductWithoutBasePrice && !hasBasePriceInput && (
                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  برای تغییر تخفیف این محصول قدیمی، ابتدا قیمت پایه را وارد کن.
                </p>
              )}
            </div>

            {/* پیش‌نمایش قیمت‌گذاری */}
            <div className="card min-w-0 space-y-3 p-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  پیش‌نمایش محاسبه قیمت برجک
                </h3>

                <span className="text-xs text-[var(--color-text-muted)]">
                  مبالغ به تومان
                </span>
              </div>

              {pricingPreview ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        قیمت پایه تأمین کالا
                      </p>
                      <p className="mt-1 break-words text-sm font-bold">
                        {pricingPreview.basePrice.toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        تخفیف از قیمت پایه ({pricingPreview.discount.toLocaleString("fa-IR")}٪)
                      </p>
                      <p className="mt-1 break-words text-sm font-bold">
                        {pricingPreview.supplierDiscountAmount.toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        مبلغ قابل تسویه هر واحد
                      </p>
                      <p className="mt-1 break-words text-sm font-bold">
                        {pricingPreview.supplierPayoutPrice.toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        کمیسیون برجک
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {pricingPreview.commissionPercent.toLocaleString("fa-IR")}٪
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-[var(--color-border)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        قیمت عادی مشتری قبل از تخفیف
                      </p>
                      <p className="mt-1 break-words text-sm font-bold">
                        {pricingPreview.originalPrice.toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--color-accent)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        قیمت نهایی مشتری بعد از تخفیف
                      </p>
                      <p className="mt-1 break-words text-base font-bold text-[var(--color-accent)]">
                        {pricingPreview.price.toLocaleString("fa-IR")} تومان
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--color-border)] p-3">
                      <p className="text-xs text-[var(--color-text-muted)]">
                        اختلاف قیمت فروش و مبلغ تسویه
                      </p>
                      <p className="mt-1 break-words text-sm font-bold">
                        {(pricingPreview.price - pricingPreview.supplierPayoutPrice).toLocaleString("fa-IR")} تومان
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-5 text-[var(--color-text-muted)]">
                    ابتدا تخفیف از قیمت پایه تأمین کالا کم می‌شود؛ سپس کمیسیون برجک روی مبلغ تخفیف‌خورده محاسبه می‌شود. قیمت عادی مشتری نیز جداگانه با احتساب کمیسیون و گردکردن رو به بالا تا مضرب ۱۰٬۰۰۰ تومان نمایش داده می‌شود.
                  </p>
                </>
              ) : preserveLegacyPricing ? (
                <div className="rounded-xl bg-[var(--color-surface-2)] p-3 text-sm leading-6 text-[var(--color-text-muted)]">
                  این محصول قدیمی هنوز قیمت پایه مستقلی ندارد. اگر فقط اطلاعاتی مثل عنوان، تصویر یا مشخصات را تغییر بدهی، قیمت فعلی آن حفظ می‌شود.

                  <p className="mt-2 font-semibold text-[var(--color-text)]">
                    قیمت فعلی مشتری:{" "}
                    {Number(editingProduct.price).toLocaleString("fa-IR")} تومان
                  </p>
                </div>
              ) : pricingPreviewError ? (
                <p className="rounded-xl bg-red-500/10 p-3 text-sm leading-6 text-red-500">
                  {pricingPreviewError}
                </p>
              ) : (
                <p className="text-sm leading-6 text-[var(--color-text-muted)]">
                  قیمت پایه را وارد کن تا پیش‌نمایش قیمت مشتری و سود برجک نمایش داده شود.
                </p>
              )}
            </div>

            {/* موجودی محصول */}
            <div className="min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:col-span-2 sm:p-5">
              <div className="mb-4">
                <h3 className="text-sm font-bold text-[var(--color-text)]">
                  مدیریت موجودی کالا
                </h3>

                <p className="mt-1 text-xs leading-6 text-[var(--color-text-muted)]">
                  تعداد واقعی کالاهای موجود نزد فروشگاه یا تأمین‌کننده را وارد کن.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="product-stock"
                    className="mb-2 block text-sm font-medium"
                  >
                    تعداد کل موجودی (عدد)
                  </label>

                  <input
                    id="product-stock"
                    type="number"
                    min={formReservedStock}
                    max={MAX_PRODUCT_STOCK}
                    step="1"
                    required
                    inputMode="numeric"
                    value={form.stock}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        stock: event.target.value,
                      }))
                    }
                    placeholder="مثلاً 25"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)]"
                  />

                  <p className="mt-2 text-xs leading-6 text-[var(--color-text-muted)]">
                    موجودی کل شامل کالاهای رزروشده هم می‌شود.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      موجودی کل
                    </p>

                    <p className="mt-2 text-lg font-black">
                      {formStockValid
                        ? formStockValue.toLocaleString("fa-IR")
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl bg-blue-500/10 p-3">
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      رزروشده
                    </p>

                    <p className="mt-2 text-lg font-black text-blue-600 dark:text-blue-400">
                      {formReservedStock.toLocaleString("fa-IR")}
                    </p>
                  </div>

                  <div className="rounded-xl bg-green-500/10 p-3">
                    <p className="text-[11px] text-green-600 dark:text-green-400">
                      قابل خرید
                    </p>

                    <p className="mt-2 text-lg font-black text-green-600 dark:text-green-400">
                      {formAvailableStock.toLocaleString("fa-IR")}
                    </p>
                  </div>
                </div>
              </div>

              {formStockValid && formStockValue < formReservedStock && (
                <p className="mt-3 rounded-xl bg-red-500/10 p-3 text-xs leading-6 text-red-500">
                  موجودی کل نمی‌تواند کمتر از تعداد رزروشده باشد.
                </p>
              )}

              <p className="mt-4 rounded-xl bg-[var(--color-surface-2)] p-3 text-xs leading-6 text-[var(--color-text-muted)]">
                موجودی رزروشده توسط سیستم و بر اساس سفارش‌ها مدیریت می‌شود.
                نیازی به واردکردن دستی آن نیست. موجودی قابل خرید برابر
                موجودی کل منهای موجودی رزروشده است.
              </p>
            </div>

            {/* تصاویر محصول */}
            <div className="min-w-0 sm:col-span-2">
              <p className="mb-3 text-sm font-medium">
                تصاویر محصول
              </p>

              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0">
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4">
                    {form.gallery.length === 0 && (
                      <div className="flex aspect-square w-full max-w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                        <PhotoIcon className="h-8 w-8 sm:h-10 sm:w-10" />
                        <span className="mt-2 text-[10px] sm:text-xs">
                          بدون تصویر
                        </span>
                      </div>
                    )}

                    {form.gallery.map((img, index) => (
                      <div
                        key={`${img}-${index}`}
                        className={`relative aspect-square w-full max-w-32 overflow-hidden rounded-xl border ${
                          form.image === img
                            ? "border-[var(--color-accent)]"
                            : "border-[var(--color-border)]"
                        }`}
                      >
                        <Image
                          src={img}
                          alt={`تصویر محصول ${index + 1}`}
                          fill
                          sizes="(max-width: 640px) 30vw, 128px"
                          className="cursor-pointer object-contain"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              image: img,
                              gallery: [
                                img,
                                ...prev.gallery.filter(
                                  (image) => image !== img
                                ),
                              ],
                            }))
                          }
                        />

                        {form.image === img && (
                          <span className="pointer-events-none absolute bottom-0 right-0 left-0 z-10 bg-[var(--color-text)] px-1 py-1 text-center text-[10px] text-[var(--color-surface)]">
                            اصلی
                          </span>
                        )}

                        <button
                          type="button"
                          aria-label="حذف تصویر"
                          onClick={() =>
                            setForm((prev) => {
                              const gallery =
                                prev.gallery.filter(
                                  (_, i) => i !== index
                                );

                              return {
                                ...prev,
                                gallery,
                                image: gallery.includes(prev.image)
                                  ? prev.image
                                  : gallery[0] || "",
                              };
                            })
                          }
                          className="absolute right-1 top-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow transition hover:bg-red-700"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}

                    {form.gallery.length < 5 && (
                      <label className="flex aspect-square w-full max-w-32 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] transition hover:border-[var(--color-accent)]">
                        <input
                          type="file"
                          hidden
                          multiple
                          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
                          disabled={galleryUploading}
                          onChange={handleGalleryUpload}
                        />

                        {galleryUploading ? (
                          <ArrowPathIcon className="h-8 w-8 animate-spin" />
                        ) : (
                          <>
                            <PhotoIcon className="h-8 w-8 text-[var(--color-text-muted)]" />
                            <span className="mt-2 text-[10px] text-[var(--color-text-muted)] sm:text-xs">
                              افزودن تصویر
                            </span>
                          </>
                        )}
                      </label>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                    حداکثر ۵ تصویر مجاز است. روی هر تصویر کلیک کن تا
                    به‌عنوان تصویر اصلی انتخاب شود.
                  </p>
                </div>

                <ProductImageGuide />
              </div>
            </div>
          </div>

          {/* توضیحات */}
          <div className="min-w-0">
            <label className="mb-2 block text-sm font-medium">
              توضیحات محصول
            </label>

            <textarea
              placeholder="توضیحات محصول"
              value={form.description}
              rows={4}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              className="w-full min-w-0 resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm leading-7 text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] sm:px-4"
            />
          </div>

          {/* مشخصات فنی */}
          <section className="min-w-0 rounded-2xl border border-[var(--color-border)] p-3 sm:p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-[var(--color-text)]">
                  مشخصات فنی
                </h3>

                <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
                  عنوان و مقدار مشخصه را وارد کن.
                </p>
              </div>

              <button
                type="button"
                onClick={addSpec}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)] sm:w-auto"
              >
                <PlusIcon className="h-4 w-4" />
                افزودن مشخصه
              </button>
            </div>

            {form.specs.length === 0 ? (
              <p className="rounded-xl bg-[var(--color-surface-2)] px-3 py-5 text-center text-sm text-[var(--color-text-muted)]">
                هنوز مشخصه‌ای اضافه نشده است.
              </p>
            ) : (
              <div className="flex min-w-0 flex-col gap-3">
                {form.specs.map((spec, index) => (
                  <div
                    key={index}
                    className="grid min-w-0 grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]"
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
                      placeholder="عنوان مشخصه؛ مثلاً حافظه داخلی"
                      aria-label={`عنوان مشخصه ${index + 1}`}
                      className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
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
                      placeholder="مقدار؛ مثلاً 256 گیگابایت"
                      aria-label={`مقدار مشخصه ${index + 1}`}
                      className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                    />

                    <button
                      type="button"
                      onClick={() => removeSpec(index)}
                      aria-label="حذف مشخصه"
                      className="inline-flex h-10 w-full items-center justify-center rounded-lg text-sm text-red-500 transition hover:bg-red-500/10 sm:w-10"
                    >
                      حذف مشخصه
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {formError && (
            <p
              role="alert"
              className="break-words rounded-xl bg-red-500/10 p-3 text-sm leading-6 text-red-500"
            >
              {formError}
            </p>
          )}

          {/* دکمه‌های فرم */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={submitting || galleryUploading}
              className="w-full rounded-xl border border-[var(--color-border)] px-5 py-3 text-sm transition hover:bg-[var(--color-surface-2)] disabled:opacity-50 sm:w-auto"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                galleryUploading ||
                transferringOwnership
              }
              className="btn-primary w-full rounded-xl px-6 py-3 text-sm disabled:opacity-50 sm:w-auto"
            >
              {submitting
                ? "در حال ذخیره..."
                : editingProduct
                  ? "ذخیره تغییرات"
                  : "ثبت محصول"}
            </button>
          </div>
        </form>
      )}

      {/* خطای دریافت محصولات */}
      {listError && (
        <p
          role="alert"
          className="break-words rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"
        >
          {listError}
        </p>
      )}

      {/* فهرست محصولات */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="card h-40 animate-pulse"
            />
          ))}
        </div>
      ) : !listError && products.length === 0 ? (
        <div className="card px-4 py-10 text-center text-sm text-[var(--color-text-muted)]">
          {view === "archived"
            ? "محصول آرشیوشده‌ای وجود ندارد."
            : view === "pending"
              ? "محصولی در انتظار بررسی نیست."
              : view === "approved"
                ? "محصول تأییدشده‌ای وجود ندارد."
                : view === "rejected"
                  ? "محصول ردشده‌ای وجود ندارد."
                  : "هنوز محصولی ثبت نشده."}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {products.map((product) => {
            const stockValue = getSafeInteger(product.stock);
            const reservedStock = getSafeInteger(
              product.reservedStock
            );

            const availableStock = Math.max(
              0,
              stockValue - reservedStock
            );

            let productPricing = null;

            if (product.basePrice != null) {
              try {
                productPricing = calculateProductPricing({
                  basePrice: Number(product.basePrice),
                  discount: Number(product.discount ?? 0),
                });
              } catch {
                // اطلاعات قدیمی یا ناسازگار نباید فهرست را از کار بیندازد.
              }
            }

            const reviewStatus =
              reviewStatusLabels[product.reviewStatus] ||
              "نامشخص";

            const isModerating =
              moderatingProductId === product.id;

            return (
              <article
                key={product.id}
                className="card flex min-w-0 flex-col gap-3 overflow-hidden p-3 transition-shadow hover:shadow-md sm:p-4"
              >
                {/* اطلاعات محصول */}
                <div className="min-w-0">
                  <h3 className="break-words text-base font-bold leading-7 text-[var(--color-text)] sm:text-lg">
                    {product.title}
                  </h3>

                  <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">
                    دسته‌بندی: {product.category?.title || "—"}
                  </p>

                  <p className="mt-2 break-words text-sm font-bold text-[var(--color-text)]">
                    قیمت نهایی مشتری:{" "}
                    {Number(product.price).toLocaleString("fa-IR")} تومان
                  </p>

                  {product.basePrice != null && (
                    <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">
                      قیمت پایه:{" "}
                      {Number(product.basePrice).toLocaleString("fa-IR")} تومان

                      {product.commissionPercent != null && (
                        <>
                          ؛ کمیسیون برجک:{" "}
                          {Number(product.commissionPercent).toLocaleString("fa-IR")}٪
                        </>
                      )}
                    </p>
                  )}

                  {productPricing && (
                    <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">
                      تخفیف از قیمت پایه:{" "}
                      {productPricing.discount.toLocaleString("fa-IR")}٪؛
                      مبلغ تسویه هر واحد:{" "}
                      {productPricing.supplierPayoutPrice.toLocaleString("fa-IR")} تومان
                    </p>
                  )}

                  {product.supplier && (
                    <p className="mt-1 break-words text-xs text-[var(--color-text-muted)]">
                      مالک: {product.supplier.name}
                      {!product.supplier.isActive && " (غیرفعال)"}
                    </p>
                  )}

                  {product.specs?.length > 0 && (
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {product.specs.length.toLocaleString("fa-IR")} مشخصه فنی
                    </p>
                  )}
                </div>

                {/* تصاویر */}
                <ProductImageGallery product={product} />

                {/* وضعیت موجودی */}
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs text-[var(--color-text)]">
                    موجودی کل:{" "}
                    <strong>{stockValue.toLocaleString("fa-IR")}</strong>
                  </span>

                  <span className="rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-600">
                    رزروشده:{" "}
                    {reservedStock.toLocaleString("fa-IR")}
                  </span>

                  <span className="rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs text-green-600">
                    قابل خرید:{" "}
                    {availableStock.toLocaleString("fa-IR")}
                  </span>
                </div>

                {/* وضعیت بررسی و انتشار */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${
                      product.reviewStatus === "APPROVED"
                        ? "bg-green-500/10 text-green-600"
                        : product.reviewStatus === "REJECTED"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {reviewStatus}
                  </span>

                  <span
                    className={`rounded-lg px-2.5 py-1.5 text-xs ${
                      product.isPublished
                        ? "bg-green-500/10 text-green-600"
                        : "bg-orange-500/10 text-orange-600"
                    }`}
                  >
                    {product.isPublished
                      ? "منتشرشده"
                      : "منتشرنشده"}
                  </span>
                </div>

                {/* پیام مدیریت */}
                {product.reviewNote && (
                  <div className="min-w-0 rounded-xl bg-[var(--color-surface-2)] p-3">
                    <p className="mb-1 text-xs font-bold text-[var(--color-text)]">
                      {product.reviewStatus === "REJECTED"
                        ? "دلیل رد محصول:"
                        : "پیام مدیریت:"}
                    </p>

                    <p className="break-words text-xs leading-6 text-[var(--color-text-muted)]">
                      {product.reviewNote}
                    </p>
                  </div>
                )}

                {/* عملیات */}
                {view !== "archived" ? (
                  <div className="grid min-w-0 grid-cols-2 gap-2 border-t border-[var(--color-border)] pt-3 sm:flex sm:flex-wrap">
                    {isAdmin && (
                      <>
                        {(product.reviewStatus === "PENDING" ||
                          product.reviewStatus === "REJECTED") && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() =>
                              updateProductReview(product, "APPROVED")
                            }
                            className="min-w-0 rounded-xl bg-green-500/10 px-3 py-2.5 text-xs font-medium text-green-600 transition hover:bg-green-500/20 disabled:opacity-50"
                          >
                            {isModerating
                              ? "..."
                              : product.reviewStatus === "REJECTED"
                                ? "تأیید مجدد"
                                : "تأیید محصول"}
                          </button>
                        )}

                        {product.reviewStatus === "PENDING" && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() =>
                              updateProductReview(product, "REJECTED")
                            }
                            className="min-w-0 rounded-xl bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-600 transition hover:bg-red-500/20 disabled:opacity-50"
                          >
                            رد محصول
                          </button>
                        )}

                        {product.reviewStatus === "APPROVED" && (
                          <button
                            type="button"
                            disabled={isModerating}
                            onClick={() =>
                              toggleProductPublication(product)
                            }
                            className="min-w-0 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)] disabled:opacity-50"
                          >
                            {isModerating
                              ? "..."
                              : product.isPublished
                                ? "خروج از انتشار"
                                : "انتشار محصول"}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => startEditing(product)}
                          aria-label="ویرایش محصول"
                          className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-xs font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-surface-2)]"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          ویرایش و موجودی
                        </button>

                        <button
                          type="button"
                          onClick={() => archiveProduct(product.id)}
                          aria-label="آرشیو محصول"
                          className="inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-red-500/20 px-3 py-2.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10"
                        >
                          <XMarkIcon className="h-4 w-4" />
                          آرشیو
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  isAdmin && (
                    <div className="border-t border-[var(--color-border)] pt-3">
                      <button
                        type="button"
                        onClick={() => restoreProduct(product.id)}
                        disabled={restoring === product.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-500/10 px-4 py-2.5 text-sm font-medium text-green-600 transition hover:bg-green-500/20 disabled:opacity-50 sm:w-auto"
                      >
                        <ArrowPathIcon
                          className={`h-4 w-4 ${
                            restoring === product.id ? "animate-spin" : ""
                          }`}
                        />
                        بازگردانی محصول
                      </button>
                    </div>
                  )
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
