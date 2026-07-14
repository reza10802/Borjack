"use client";
import { useEffect, useState } from "react";

const ACTION_LABELS = {
  CREATE_PRODUCT: "ایجاد کالا",
  UPDATE_PRODUCT: "ویرایش کالا",
  DELETE_PRODUCT: "حذف کالا",
  UPDATE_STOCK: "تغییر موجودی",
  CREATE_ORDER: "ثبت سفارش",
  UPDATE_ORDER_STATUS: "تغییر وضعیت سفارش",
  CREATE_USER: "ثبت کاربر",
  UPDATE_USER: "ویرایش کاربر",
  DELETE_USER: "حذف کاربر",
};

const ACTION_COLORS = {
  CREATE_PRODUCT: "bg-green-100 text-green-700",
  UPDATE_PRODUCT: "bg-blue-100 text-blue-700",
  DELETE_PRODUCT: "bg-red-100 text-red-600",
  UPDATE_STOCK: "bg-yellow-100 text-yellow-700",
  CREATE_ORDER: "bg-green-100 text-green-700",
  UPDATE_ORDER_STATUS: "bg-purple-100 text-purple-700",
  CREATE_USER: "bg-green-100 text-green-700",
  UPDATE_USER: "bg-blue-100 text-blue-700",
  DELETE_USER: "bg-red-100 text-red-600",
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState("");

  const load = (p = 1, action = "") => {
    setLoading(true);
    const params = new URLSearchParams({ page: p, ...(action ? { action } : {}) });
    fetch(`/api/admin/logs?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setTotalPages(d.totalPages || 1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(page, filter); }, [page, filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">لاگ‌های سیستم</h1>
        <select
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none"
        >
          <option value="">همه عملیات</option>
          {Object.entries(ACTION_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400">لاگی یافت نشد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3 font-medium">عملیات</th>
                <th className="px-4 py-3 font-medium">توضیح</th>
                <th className="px-4 py-3 font-medium">کاربر</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.description || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{log.user?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{log.ipAddress || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(log.createdAt).toLocaleString("fa-IR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
          >
            قبلی
          </button>
          <span className="px-3 py-1.5 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}