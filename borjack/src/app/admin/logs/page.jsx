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
  CREATE_PRODUCT: "bg-green-500/10 text-green-500",
  UPDATE_PRODUCT: "bg-blue-500/10 text-blue-500",
  DELETE_PRODUCT: "bg-red-500/10 text-red-500",

  UPDATE_STOCK: "bg-yellow-500/10 text-yellow-600",

  CREATE_ORDER: "bg-emerald-500/10 text-emerald-500",

  UPDATE_ORDER_STATUS: "bg-purple-500/10 text-purple-500",

  CREATE_USER: "bg-green-500/10 text-green-500",

  UPDATE_USER: "bg-blue-500/10 text-blue-500",

  DELETE_USER: "bg-red-500/10 text-red-500",
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            لاگ‌های سیستم
          </h1>

          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            تاریخچه عملیات پنل
          </p>
        </div>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none transition"
        >
          <option value="">همه عملیات</option>

          {Object.entries(ACTION_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            لاگی یافت نشد
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-5 py-4 text-right font-semibold">عملیات</th>
                <th className="px-5 py-4 text-right font-semibold">توضیح</th>
                <th className="px-5 py-4 text-right font-semibold">کاربر</th>
                <th className="px-5 py-4 text-right font-semibold">IP</th>
                <th className="px-5 py-4 text-right font-semibold">زمان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="transition hover:bg-[var(--color-surface-2)]"
                >
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${ACTION_COLORS[log.action] ??
                        "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        }`}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td className="px-5 py-4 max-w-xs truncate text-[var(--color-text)]">
                    {log.description || "—"}
                  </td>
                  <td className="px-5 py-4 text-[var(--color-text)]">
                    {log.user?.name || "—"}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-[var(--color-text-muted)]">
                    {log.ipAddress || "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-[var(--color-text-muted)]">
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
        <div className="mt-6 flex items-center justify-center gap-3">

          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn--outline disabled:opacity-40 dark:text-dark-muted"
          >
            قبلی
          </button>

          <span className="text-sm text-[var(--color-text-muted)]">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn--outline disabled:opacity-40 dark:text-dark-muted"
          >
            بعدی
          </button>

        </div>
      )}
    </div>
  );
}