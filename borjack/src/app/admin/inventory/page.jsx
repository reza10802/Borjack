"use client";
import { useEffect, useState } from "react";

export default function AdminInventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  const load = () => {
    fetch("/api/admin/inventory")
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleStock = async (productId, currentStock) => {
    setSaving(productId);
    await fetch("/api/admin/inventory", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, inStock: !currentStock }),
    });
    setProducts((prev) =>
      prev.map((p) => p.id === productId ? { ...p, inStock: !currentStock } : p)
    );
    setSaving(null);
  };

  const outOfStock = products.filter((p) => !p.inStock).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">انبارداری</h1>
        {outOfStock > 0 && (
          <span className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full">
            {outOfStock} کالا ناموجود
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3 font-medium">کالا</th>
                <th className="px-4 py-3 font-medium">دسته</th>
                <th className="px-4 py-3 font-medium">قیمت</th>
                <th className="px-4 py-3 font-medium">وضعیت موجودی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((p) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${!p.inStock ? "bg-red-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={p.image} alt={p.title} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                      <span className="font-medium text-gray-800">{p.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.category}</td>
                  <td className="px-4 py-3 text-gray-700">{p.price.toLocaleString("fa-IR")} تومان</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStock(p.id, p.inStock)}
                      disabled={saving === p.id}
                      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                        p.inStock
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-red-100 text-red-600 hover:bg-red-200"
                      } disabled:opacity-50`}
                    >
                      {saving === p.id ? "..." : p.inStock ? "✓ موجود — کلیک برای ناموجود" : "✗ ناموجود — کلیک برای موجود"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}