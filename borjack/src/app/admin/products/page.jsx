"use client";

import { useState, useEffect } from "react";

const emptyForm = {
    title: "",
    price: "",
    originalPrice: "",
    discount: "0",
    category: "",
    image: "",
    description: "",
    inStock: true,
};

export default function AdminProductsPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [uploading, setUploading] = useState(false);

    useEffect(() => { fetchProducts(); }, []);

    useEffect(() => {
        if (showForm) fetchCategories();
    }, [showForm]);

    const fetchCategories = async () => {
        try {
            const res = await fetch("/api/categories");
            if (res.ok) {
                const data = await res.json();
                const cats = data.categories || [];
                setCategories(cats);
                if (cats.length > 0) setForm(f => ({ ...f, category: f.category || cats[0].name }));
            }
        } catch {}
    };

    const fetchProducts = async () => {
        setListError("");
        try {
            const res = await fetch("/api/admin/products");
            if (res.ok) {
                const data = await res.json();
                // ۴. درست کردن parse — API داره { products } برمیگردونه
                setProducts(Array.isArray(data) ? data : (data.products || []));
            } else {
                let message = `خطا در دریافت محصولات (کد ${res.status})`;
                try { const d = await res.json(); if (d?.error) message = d.error; } catch {}
                setListError(message);
                setProducts([]);
            }
        } catch {
            setListError("خطا در ارتباط با سرور");
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleStock = async (product) => {
        const res = await fetch(`/api/admin/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inStock: !product.inStock }),
        });
        if (res.ok) {
            const data = await res.json();
            const updated = data.product || data;
            setProducts(products.map(p => p.id === product.id ? updated : p));
        }
    };

    const deleteProduct = async (id) => {
        if (!confirm("مطمئنی می‌خوای این محصول رو حذف کنی؟")) return;
        try {
            const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
            if (res.ok) { setProducts(products.filter(p => p.id !== id)); return; }
            let message = "حذف نشد";
            try { const d = await res.json(); message = d.error || message; } catch { message = `حذف نشد (کد: ${res.status})`; }
            alert(message);
        } catch { alert("خطا در ارتباط با سرور"); }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFormError(""); setUploading(true);
        try {
            const body = new FormData();
            body.append("image", file);
            const res = await fetch("/api/admin/upload", { method: "POST", body });
            const data = await res.json();
            if (!res.ok) { setFormError(data.error || "خطا در آپلود تصویر"); return; }
            setForm(f => ({ ...f, image: data.url }));
        } catch { setFormError("خطا در ارتباط با سرور هنگام آپلود"); }
        finally { setUploading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError("");
        if (!form.title || !form.price || !form.category || !form.image || !form.description) {
            setFormError("همه فیلدهای ضروری رو پر کن"); return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/products", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    price: Number(form.price),
                    originalPrice: Number(form.originalPrice) || Number(form.price),
                    discount: Number(form.discount) || 0,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setFormError(data.error || "خطا در ساخت محصول"); return; }
            // ۴. درست کردن — data.product نه data
            setProducts([data.product, ...products]);
            setForm({ ...emptyForm, category: categories[0]?.name || "" });
            setShowForm(false);
        } catch { setFormError("خطا در ارتباط با سرور"); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">محصولات ({products.length})</h2>
                <button onClick={() => setShowForm(s => !s)}
                    className="px-4 py-2 text-sm bg-black text-white rounded-xl hover:bg-gray-800 transition">
                    {showForm ? "بستن فرم" : "+ محصول جدید"}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input placeholder="عنوان محصول" value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400">
                            {categories.length === 0
                                ? <option value="">ابتدا دسته‌بندی اضافه کن</option>
                                : categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                            }
                        </select>
                        <input type="number" placeholder="قیمت (تومان)" value={form.price}
                            onChange={e => setForm({ ...form, price: e.target.value })}
                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                        <input type="number" placeholder="قیمت قبل از تخفیف (اختیاری)" value={form.originalPrice}
                            onChange={e => setForm({ ...form, originalPrice: e.target.value })}
                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                        <input type="number" placeholder="درصد تخفیف (مثلا 15)" value={form.discount}
                            onChange={e => setForm({ ...form, discount: e.target.value })}
                            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400" />
                        <div className="flex items-center gap-3 sm:col-span-2">
                            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center text-gray-300 text-xs">
                                {form.image ? <img src={form.image} alt="پیش‌نمایش" className="w-full h-full object-cover" /> : "بدون عکس"}
                            </div>
                            <label className="flex-1 cursor-pointer">
                                <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                                <span className={`inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm border transition ${uploading ? "border-gray-200 text-gray-400" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
                                    {uploading ? "در حال آپلود..." : form.image ? "تغییر عکس" : "انتخاب عکس"}
                                </span>
                            </label>
                        </div>
                    </div>
                    <textarea placeholder="توضیحات محصول" value={form.description} rows={3}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 resize-none" />
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={form.inStock} onChange={e => setForm({ ...form, inStock: e.target.checked })} className="w-4 h-4" />
                        موجود است
                    </label>
                    {formError && <p className="text-red-500 text-sm">{formError}</p>}
                    <button type="submit" disabled={submitting || uploading}
                        className="self-start px-5 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
                        {submitting ? "در حال ثبت..." : "ثبت محصول"}
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
                    {products.map(product => (
                        <div key={product.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                                {product.image && <img src={product.image} alt={product.title} className="w-full h-full object-cover" onError={e => e.target.style.display = "none"} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-800 line-clamp-1">{product.title}</p>
                                <p className="text-xs text-gray-400">{product.category} • {product.price?.toLocaleString()} تومان</p>
                            </div>
                            <button onClick={() => toggleStock(product)}
                                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${product.inStock ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                                {product.inStock ? "موجود" : "ناموجود"}
                            </button>
                            <button onClick={() => deleteProduct(product.id)}
                                className="text-gray-300 hover:text-red-500 transition text-lg leading-none px-1">✕</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}