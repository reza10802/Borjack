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

  const load = async (p = 1, action = "") => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(p),
        ...(action ? { action } : {}),
      });

      const res = await fetch(`/api/admin/logs?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setLogs([]);
        setTotalPages(1);
        return;
      }

      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("LOAD LOGS ERROR:", error);
      setLogs([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page, filter);
  }, [page, filter]);

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">
            لاگ‌های سیستم
          </h1>

          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            تاریخچه عملیات پنل
          </p>
        </div>

        {/* Filter */}
        <div className="w-full sm:w-[220px]">
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] transition focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">همه عملیات</option>

            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card min-w-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            لاگی یافت نشد
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-sm">
              <colgroup>
                <col className="w-[170px]" />
                <col className="w-[330px]" />
                <col className="w-[160px]" />
                <col className="w-[150px]" />
                <col className="w-[190px]" />
              </colgroup>

              <thead>
                <tr className="bg-[var(--color-surface-2)]">
                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    عملیات
                  </th>

                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    توضیح
                  </th>

                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    کاربر
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    IP
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    زمان
                  </th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    {/* Action */}
                    <td className="px-5 py-4 align-middle">
                      <span
                        className={`inline-flex min-w-[90px] justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                          ACTION_COLORS[log.action] ??
                          "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-4 align-middle">
                      <div
                        className="max-w-[300px] truncate text-[var(--color-text)]"
                        title={log.description || ""}
                      >
                        {log.description || "—"}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-5 py-4 align-middle">
                      <div className="max-w-[140px] truncate text-[var(--color-text)]">
                        {log.user?.name || "—"}
                      </div>
                    </td>

                    {/* IP */}
                    <td className="px-4 py-4 align-middle">
                      <span
                        dir="ltr"
                        className="block whitespace-nowrap text-right font-mono text-xs text-[var(--color-text-muted)]"
                      >
                        {log.ipAddress || "—"}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-4 align-middle">
                      <span className="block whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                        {new Date(log.createdAt).toLocaleString("fa-IR")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="h-9 rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            قبلی
          </button>

          <span className="min-w-[70px] text-center text-sm text-[var(--color-text-muted)]">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() =>
              setPage((p) => Math.min(totalPages, p + 1))
            }
            disabled={page === totalPages || loading}
            className="h-9 rounded-lg border border-[var(--color-border)] px-4 text-sm text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            بعدی
          </button>
        </div>
      )}
    </div>
  );
}
