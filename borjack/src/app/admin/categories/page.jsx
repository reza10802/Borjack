"use client";
import { useEffect, useState } from "react";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/categories")
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setCategories(d.categories || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!title.trim()) { setError("عنوان دسته‌بندی را وارد کن"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    setTitle("");
    setSaving(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("مطمئنی؟")) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          دسته‌بندی‌ها
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {categories.length} دسته‌بندی
        </p>
      </div>

      <div className="card mb-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
          افزودن دسته‌بندی جدید
        </h2>

        <div className="flex gap-3 mb-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="عنوان دسته‌بندی — مثلاً: پزشکی"
            className=" flex-1 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition "
          />
          <button onClick={handleAdd} disabled={saving}
            className=" h-11 px-5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 whitespace-nowrap ">
            {saving ? "..." : "+ افزودن"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">
          {error}
        </p>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-[var(--color-surface-2)] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          {categories.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
              دسته‌بندی‌ای ثبت نشده
            </p>
          ) : (
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
                {categories.map(c => (
                  <tr key={c.id} className="transition hover:bg-[var(--color-surface-2)]">
                    <td className="px-5 py-4 font-medium text-[var(--color-text)]">{c.title}</td>
                    <td className="px-4 py-3 text-left">
                      <button onClick={() => handleDelete(c.id)}
                        className=" h-9 px-4 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition text-xs font-medium ">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}