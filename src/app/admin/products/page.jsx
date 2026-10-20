"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Select from "react-select";
import {
  XMarkIcon,
  PhotoIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";

const emptyForm = {
  title: "",
  originalPrice: "",
  price: "",
  categoryId: "",
  image: "",
  gallery: [],
  description: "",
  stock: 0,
  specs: [],
};


const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 46,
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
    "&:active": {
      backgroundColor: "var(--color-accent)",
      opacity: 0.85,
    },
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
  }),

  indicatorsContainer: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
  }),

  dropdownIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    "&:hover": {
      color: "var(--color-accent)",
    },
  }),

  clearIndicator: (base) => ({
    ...base,
    color: "var(--color-text-muted)",
    "&:hover": {
      color: "var(--color-accent)",
    },
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


export default function AdminProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (showForm && isAdmin) fetchCategories();
  }, [showForm, isAdmin]);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        const cats = data.categories || [];
        setCategories(cats);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    setListError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      if (!res.ok) {
        setListError(data.error || "خطا در دریافت محصولات");
        setProducts([]);
        return;
      }
      setProducts(data.products || []);
    } catch {
      setListError("خطا در ارتباط با سرور");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleStock = async (product) => {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: product.stock > 0 ? 0 : 1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "خطا در تغییر موجودی");
        return;
      }
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data.product : p)));
    } catch {
      alert("خطا در ارتباط با سرور");
    }
  };

  const deleteProduct = async (id) => {
    if (!isAdmin) return;
    if (!confirm("مطمئنی می‌خوای این محصول رو حذف کنی؟")) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "حذف نشد");
        return;
      }
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      alert("خطا در ارتباط با سرور");
    }
  };

  const originalPrice = form.originalPrice === "" ? Number(form.price) : Number(form.originalPrice);
  const price = Number(form.price);
  const discount = originalPrice > 0
    ? Math.min(100, Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100)))
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    setFormError("");
    const method = editingProduct ? "PATCH" : "POST";
    const url = editingProduct ? `/api/admin/products/${editingProduct.id}` : "/api/admin/products";
    const cleanSpecs = (form.specs || [])
      .map((spec) => ({ key: String(spec.key || "").trim(), value: String(spec.value || "").trim() }))
      .filter((spec) => spec.key && spec.value);

    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.categoryId ||
      form.gallery.length === 0 ||
      Number(form.price) <= 0
    ) {
      setFormError("همه فیلدهای ضروری را پر کن");
      return;
    }
    if (Number(form.price) > originalPrice) {
      setFormError("قیمت فروش نمی‌تواند بیشتر از قیمت اصلی باشد");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          price,
          originalPrice,
          discount,
          categoryId: Number(form.categoryId),
          image: form.image,
          gallery: form.gallery,
          description: form.description.trim(),
          stock: Number(form.stock),
          specs: cleanSpecs,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "خطا در ذخیره محصول");
        return;
      }

      if (editingProduct) {
        setProducts((prev) => prev.map((p) => p.id === data.product.id ? data.product : p));
      } else {
        setProducts((prev) => [data.product, ...prev]);
      }

      setEditingProduct(null);
      setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
      setShowForm(false);
    } catch {
      setFormError("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.title }));

  const cancelEdit = () => {
    setEditingProduct(null);
    setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" });
    setFormError("");
    setShowForm(false);
  };


  const handleGalleryUpload = async (e) => {
    const files = [...(e.target.files || [])];
    if (!files.length) return;

    const remaining = 5 - form.gallery.length;

    if (remaining <= 0) {
      setFormError("حداکثر ۵ عکس برای هر محصول مجاز است.");
      e.target.value = "";
      return;
    }

    if (files.length > remaining) {
      setFormError(
        `فقط می‌توانی ${remaining} عکس دیگر اضافه کنی. حداکثر تعداد عکس‌ها ۵ عدد است.`
      );
    } else {
      setFormError("");
    }

    const filesToUpload = files.slice(0, remaining);

    setGalleryUploading(true);

    try {
      const uploaded = [];
      let uploadError = "";

      for (const file of filesToUpload) {
        const body = new FormData();
        body.append("image", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body,
        });

        const data = await res.json();

        if (!res.ok) {
          uploadError = data.error || "خطا در بارگذاری تصویر";
          continue;
        }

        if (data.url) uploaded.push(data.url);
      }

      setForm((prev) => {
        const gallery = [...prev.gallery, ...uploaded].slice(0, 5);

        return {
          ...prev,
          gallery,
          image: gallery[0] || "",
        };
      });

      if (uploadError) {
        setFormError(uploadError);
      }
    } catch {
      setFormError("خطا در بارگذاری تصویر");
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  };


  const updateSpec = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((spec, i) => i === index ? { ...spec, [field]: value } : spec),
    }));
  };

  const addSpec = () => {
    setForm((prev) => ({ ...prev, specs: [...(prev.specs || []), { key: "", value: "" }] }));
  };

  const removeSpec = (index) => {
    setForm((prev) => ({ ...prev, specs: prev.specs.filter((_, i) => i !== index) }));
  };

  const startEditing = (product) => {
    const gallery = product.images?.length > 0
      ? product.images.map((item) => typeof item === "string" ? item : item.url).filter(Boolean)
      : product.image ? [product.image] : [];
    setEditingProduct(product);
    setForm({
      title: product.title || "",
      price: String(product.price ?? ""),
      originalPrice: String(product.originalPrice ?? product.price ?? ""),
      categoryId: product.categoryId ?? product.category?.id ?? "",
      image: gallery[0] || product.image || "",
      gallery,
      description: product.description || "",
      stock: product.stock ?? 0,
      specs: Array.isArray(product.specs) ? product.specs.map((spec) => ({ key: spec.key || "", value: spec.value || "" })) : [],
    });
    setFormError("");
    setShowForm(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">محصولات ({products.length})</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => showForm ? cancelEdit() : (setEditingProduct(null), setForm({ ...emptyForm, categoryId: categories[0]?.id ?? "" }), setFormError(""), setShowForm(true))}
            className="btn-primary px-5 py-2.5 text-sm"
          >
            {showForm ? "بستن فرم" : "+ محصول جدید"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form onSubmit={handleSubmit} className="card flex flex-col gap-5 p-4 sm:p-6">
          <h3 className="text-lg font-bold">{editingProduct ? "ویرایش محصول" : "ثبت محصول جدید"}</h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <input
              placeholder="عنوان محصول"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />


            <Select
              styles={selectStyles}
              options={categoryOptions}
              value={
                categoryOptions.find(
                  (item) => String(item.value) === String(form.categoryId)
                ) || null
              }
              onChange={(selected) =>
                setForm((prev) => ({
                  ...prev,
                  categoryId: selected?.value ?? "",
                }))
              }
              placeholder="دسته‌بندی خود را انتخاب کنید"
              noOptionsMessage={() => "دسته‌بندی‌ای یافت نشد"}
              isSearchable
              isClearable
              className="text-sm"
              classNamePrefix="react-select"
            />


            <input
              type="number"
              min="0"
              placeholder="قیمت اصلی"
              value={form.originalPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, originalPrice: e.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />

            <input
              type="number"
              min="1"
              placeholder="قیمت فروش"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
            />

            <div className="card flex items-center justify-between px-4 py-3 sm:col-span-2">
              <span className="text-sm text-[var(--color-text-muted)]">درصد تخفیف</span>
              <span className="font-bold text-[var(--color-text)]">{discount}٪</span>
            </div>

            <div className="sm:col-span-2">
              <p className="mb-3 text-sm font-medium">تصاویر محصول</p>
              <div className="flex flex-wrap gap-4">
                {form.gallery.length === 0 && (
                  <div className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                    <PhotoIcon className="h-10 w-10" />
                    <span className="mt-2 text-xs">بدون تصویر</span>
                  </div>
                )}

                {form.gallery.map((img, index) => (
                  <div key={`${img}-${index}`} className="relative h-32 w-32 overflow-hidden rounded-xl border border-[var(--color-border)]">
                    <img
                      src={img}
                      alt={`تصویر محصول ${index + 1}`}
                      className="h-full w-full cursor-pointer object-contain"
                      onClick={() => setForm((prev) => ({ ...prev, image: img, gallery: [img, ...prev.gallery.filter((g) => g !== img)] }))}
                    />
                    {index === 0 && <span className="absolute left-2 top-2 rounded-md bg-[var(--color-text)] px-2 py-1 text-[10px] font-medium text-[var(--color-surface)]">اصلی</span>}
                    <button
                      type="button"
                      aria-label="حذف تصویر"
                      onClick={() => setForm((prev) => {
                        const gallery = prev.gallery.filter((_, i) => i !== index);
                        return { ...prev, gallery, image: gallery[0] || "" };
                      })}
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow transition hover:bg-red-700"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}


                {form.gallery.length < 5 && (
                  <label className="flex h-32 w-32 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] transition hover:border-[var(--color-accent)]">
                    <input
                      type="file"
                      hidden
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      disabled={galleryUploading}
                      onChange={handleGalleryUpload}
                    />

                    {galleryUploading ? (
                      <ArrowPathIcon className="h-8 w-8 animate-spin" />
                    ) : (
                      <PhotoIcon className="h-10 w-10 text-[var(--color-text-muted)]" />
                    )}
                  </label>
                )}

              </div>
            </div>
          </div>

          <textarea
            placeholder="توضیحات محصول"
            value={form.description}
            rows={3}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
          />

          {/* Technical specifications */}
          <section className="rounded-2xl border border-[var(--color-border)] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-[var(--color-text)]">مشخصات فنی</h4>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">برای هر ردیف، عنوان و مقدار مشخصه را وارد کن. ردیف‌های خالی ذخیره نمی‌شوند.</p>
              </div>
              <button type="button" onClick={addSpec} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                <PlusIcon className="h-4 w-4" /> افزودن مشخصه
              </button>
            </div>

            {form.specs.length === 0 ? (
              <p className="rounded-xl bg-[var(--color-surface-2)] px-4 py-5 text-center text-sm text-[var(--color-text-muted)]">هنوز مشخصه‌ای اضافه نشده است.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {form.specs.map((spec, index) => (
                  <div key={index} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      value={spec.key}
                      onChange={(e) => updateSpec(index, "key", e.target.value)}
                      placeholder="عنوان مشخصه؛ مثلاً حافظه داخلی"
                      aria-label={`عنوان مشخصه ${index + 1}`}
                      className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                    <input
                      value={spec.value}
                      onChange={(e) => updateSpec(index, "value", e.target.value)}
                      placeholder="مقدار؛ مثلاً 256 گیگابایت"
                      aria-label={`مقدار مشخصه ${index + 1}`}
                      className="w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]"
                    />
                    <button type="button" onClick={() => removeSpec(index)} aria-label="حذف مشخصه" className="inline-flex h-10 w-10 items-center justify-center justify-self-end rounded-lg text-[var(--color-text-muted)] transition hover:bg-red-500/10 hover:text-red-500 sm:justify-self-auto">
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" checked={form.stock > 0} onChange={(e) => setForm((prev) => ({ ...prev, stock: e.target.checked ? 1 : 0 }))} className="h-4 w-4 accent-[var(--color-accent)]" />
            موجود است
          </label>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <button type="submit" disabled={submitting || galleryUploading || categories.length === 0} className="btn-primary self-start disabled:opacity-50">
            {submitting ? "در حال ذخیره..." : editingProduct ? "ذخیره تغییرات" : "ثبت محصول"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">در حال بارگذاری...</p>
      ) : listError ? (
        <p className="text-sm text-red-500">{listError}</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">هنوز محصولی ثبت نشده.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <div key={product.id} className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[var(--color-surface-2)]">
                {product.image && <img src={product.image} alt={product.title} className="h-full w-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
              </div>

              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-[var(--color-text)]">{product.title}</p>
                <p className="muted mt-1 text-xs">{product.category?.title} • {product.price?.toLocaleString("fa-IR")} تومان</p>
                {product.specs?.length > 0 && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{product.specs.length} مشخصه فنی</p>}
              </div>

              <button type="button" onClick={() => toggleStock(product)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition ${product.stock > 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                {product.stock > 0 ? "موجود" : "ناموجود"}
              </button>

              <button type="button" onClick={() => startEditing(product)} aria-label="ویرایش محصول" className="shrink-0 text-[var(--color-accent)] transition hover:opacity-75">
                <PencilSquareIcon className="h-5 w-5" />
              </button>

              {isAdmin && (
                <button type="button" onClick={() => deleteProduct(product.id)} aria-label="حذف محصول" className="shrink-0 text-[var(--color-text-muted)] transition hover:text-red-500">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
