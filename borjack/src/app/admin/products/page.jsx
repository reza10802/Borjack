"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import Select from "react-select";
import {
  XMarkIcon,
  PhotoIcon,
  ArrowPathIcon,
  PencilSquareIcon
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
};

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 44,
    borderRadius: 12,
    borderColor: "#e5e7eb",
    boxShadow: "none",
    "&:hover": {
      borderColor: "#9ca3af",
    },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 50,
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
        if (cats.length > 0) {
          setForm((f) => ({
            ...f,
            categoryId: f.categoryId ?? cats[0]?.id ?? null,
          }));
        }
      }
    } catch (err) {
      console.error(err)
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

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? data.product : p))
      );
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
  const originalPrice =
    form.originalPrice === ""
      ? Number(form.price)
      : Number(form.originalPrice);

  const price = Number(form.price);

  const handleSubmit = async (e) => {

    e.preventDefault();
    if (!isAdmin) return;

    setFormError("");
    const method = editingProduct ? "PATCH" : "POST";

    const url = editingProduct
      ? `/api/admin/products/${editingProduct.id}`
      : "/api/admin/products";

    if (
      form.title.trim() === "" ||
      form.description.trim() === "" ||
      form.categoryId == null ||
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
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          price: price,
          originalPrice,
          discount,
          categoryId: Number(form.categoryId),
          image: form.image,
          gallery: form.gallery,
          description: form.description,
          stock: Number(form.stock),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "خطا در ساخت محصول");
        return;
      }

      if (editingProduct) {
        setProducts(prev =>
          prev.map(p =>
            p.id === data.product.id ? data.product : p
          )
        );
      } else {
        setProducts(prev => [data.product, ...prev]);
      }

      setEditingProduct(null);

      setForm({
        ...emptyForm,
        categoryId: categories[0]?.id ?? null,
      });
      setShowForm(false);
    } catch {
      setFormError("خطا در ارتباط با سرور");
    } finally {
      setSubmitting(false);
      setEditingProduct(null);
    }
  };

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.title,
  }));

  const cancelEdit = () => {
    setEditingProduct(null);
    setForm({
      ...emptyForm,
      categoryId: categories[0]?.id ?? null,
    });

    setShowForm(false);
  };

  const handleGalleryUpload = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;

    setGalleryUploading(true);
    setFormError("");

    try {
      const uploaded = [];

      for (const file of files) {
        const body = new FormData();
        body.append("image", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body,
        });

        const data = await res.json();

        if (!res.ok) {
          setFormError(data.error);
          continue;
        }

        uploaded.push(data.url);
      }

      setForm((prev) => {
        const gallery = [...prev.gallery, ...uploaded];

        return {
          ...prev,
          image: prev.image || gallery[0] || "",
          gallery,
        };
      });
    } finally {
      setGalleryUploading(false);
      e.target.value = "";
    }
  };

  const discount =
    originalPrice > 0
      ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((originalPrice - price) / originalPrice) * 100
          )
        )
      )
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">محصولات ({products.length})</h2>

        {isAdmin && (
          <button
            onClick={() => {
              if (showForm) {
                cancelEdit();
              } else {
                setEditingProduct(null);

                setForm({
                  ...emptyForm,
                  categoryId: categories[0]?.id ?? null,
                });

                setShowForm(true);
              }
            }}
            className="btn-primary text-sm px-5 py-2.5"
          >
            {showForm ? "بستن فرم" : "+ محصول جدید"}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <form
          onSubmit={handleSubmit}
          className="card p-6 flex flex-col gap-5"
        >
          <h3 className="text-lg font-bold">
            {editingProduct ? "ویرایش محصول" : "ثبت محصول جدید"}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              placeholder="عنوان محصول"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] outline-none transition"
            />

            <Select
              styles={selectStyles}
              options={categoryOptions}
              value={
                categoryOptions.find(
                  (item) => item.value === form.categoryId
                ) || null
              }
              onChange={(selected) =>
                setForm({
                  ...form,
                  categoryId: selected?.value ?? null,
                })
              }
              placeholder="انتخاب دسته‌بندی"
              isSearchable
              className="text-sm"
              classNamePrefix="react-select"
            />

            <input
              type="number"
              placeholder="قیمت اصلی"
              value={form.originalPrice}
              onChange={(e) => setForm({ ...form, originalPrice: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] outline-none transition"
            />

            <input
              type="number"
              placeholder="قیمت فروش"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] outline-none transition"
            />

            <div className="sm:col-span-2 card px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">
                درصد تخفیف
              </span>

              <span className="font-bold text-green-600">
                {discount}%
              </span>
            </div>

            <div className="sm:col-span-2">
              {/* گالری */}
              <p className="text-sm font-medium mb-3">
                تصاویر محصول
              </p>
              <div className="flex flex-wrap gap-4">



                {form.gallery.length === 0 && (
                  <div className="w-32 h-32 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                    <PhotoIcon className="w-10 h-10" />
                    <span className="text-xs mt-2">
                      بدون تصویر
                    </span>
                  </div>
                )}

                {form.gallery.map((img, index) => (
                  <div
                    key={index}
                    className="relative w-32 h-32 rounded-xl overflow-hidden border border-[var(--color-border)]"
                  >
                    <img
                      src={img}
                      alt={`gallery-${index}`}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          image: img,
                          gallery: [
                            img,
                            ...prev.gallery.filter((g) => g !== img),
                          ],
                        }))
                      }
                    />
                    {index === 0 && (
                      <span className="absolute top-2 left-2 bg-black text-white text-[10px] font-medium px-2 py-1 rounded-md shadow">
                        اصلی
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => {
                          const gallery = prev.gallery.filter((_, i) => i !== index);

                          return {
                            ...prev,
                            gallery,
                            image: gallery[0] || "", // اگر عکس اصلی حذف شد، عکس بعدی اصلی می‌شود
                          };
                        })
                      }
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow hover:bg-red-700"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>

                  </div>
                ))}

                {/* دکمه افزودن */}
                <label className="w-32 h-32 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-2)] flex items-center justify-center cursor-pointer hover:border-[var(--color-accent)] hover:bg-[var(--background-app)] transition">

                  <input
                    type="file"
                    hidden
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleGalleryUpload}
                  />

                  {galleryUploading ? (
                    <ArrowPathIcon className="w-8 h-8 animate-spin" />
                  ) : (
                    <PhotoIcon className="w-10 h-10 text-gray-400" />
                  )}

                </label>

              </div>

            </div>
          </div>

          <textarea
            placeholder="توضیحات محصول"
            value={form.description}
            rows={3}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] resize-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] outline-none transition"
          />

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.stock > 0}
              onChange={(e) =>
                setForm({
                  ...form,
                  stock: e.target.checked ? 1 : 0,
                })
              }
              className="w-4 h-4"
            />
            موجود است
          </label>

          {formError && <p className="text-red-500 text-sm">{formError}</p>}

          <button
            type="submit"
            disabled={
              submitting ||
              galleryUploading ||
              categories.length === 0
            }
            className="btn-primary self-start disabled:opacity-50"
          >
            {editingProduct ? "ویرایش محصول" : "ثبت محصول"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">در حال بارگذاری...</p>
      ) : listError ? (
        <p className="text-sm text-red-500">{listError}</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-400">هنوز محصولی ثبت نشده.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="card p-4 flex items-center gap-4"
            >
              <div className="w-14 h-14 rounded-xl bg-[var(--color-surface-2)] overflow-hidden shrink-0">
                {product.image && (
                  <img
                    src={product.image}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text)]">{product.title}</p>
                <p className="text-xs muted">
                  {product.category?.title} • {product.price?.toLocaleString()} تومان
                </p>
              </div>

              <button
                onClick={() => toggleStock(product)}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition ${product.stock > 0
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
                  }`}
              >
                {product.stock > 0 ? "موجود" : "ناموجود"}
              </button>

              <button
                onClick={() => {
                  setEditingProduct(product);

                  const gallery =
                    product.images?.length > 0
                      ? product.images.map((i) => i.url)
                      : product.image
                        ? [product.image]
                        : [];

                  setForm({
                    title: product.title,
                    price: String(product.price),
                    originalPrice: String(product.originalPrice),
                    categoryId: product.categoryId,
                    image: gallery[0] || "",
                    gallery,
                    description: product.description,
                    stock: product.stock,
                  });

                  setShowForm(true);
                }}
                className="text-[var(--color-accent)] hover:scale-110 transition"
              >
                <PencilSquareIcon className="w-5 h-5" />
              </button>

              {isAdmin && (
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="text-[var(--color-text-muted)] hover:text-red-500 transition"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}