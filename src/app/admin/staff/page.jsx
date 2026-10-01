"use client";

import { useEffect, useState } from "react";
import Select from "react-select";
import { selectStyles } from "@/components/ui/selectStyles";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/users?role=staff", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت کارکنان");
        setStaff([]);
        return;
      }

      setStaff(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error("LOAD STAFF ERROR:", error);
      setError("خطا در ارتباط با سرور");
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = staff.filter((u) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return (
      u.name?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  async function changeRole(userId, role) {
    if (!role) return;

    setUpdating(userId);
    setError("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر نقش");
        return;
      }

      setStaff((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
    } catch (error) {
      console.error("CHANGE STAFF ROLE ERROR:", error);
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          مدیریت کارکنان
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {filteredStaff.length} کارمند
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="card mb-6 min-w-0 p-4">
        <input
          type="text"
          placeholder="جستجوی نام یا شماره موبایل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {/* Staff Table */}
      <div className="card min-w-0 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            کارمندی پیدا نشد
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <colgroup>
                <col className="w-[240px]" />
                <col className="w-[190px]" />
                <col className="w-[140px]" />
                <col className="w-[180px]" />
              </colgroup>

              <thead>
                <tr className="bg-[var(--color-surface-2)]">
                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    نام
                  </th>

                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    شماره موبایل
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-center font-semibold text-[var(--color-text-muted)]">
                    نقش
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    تغییر نقش
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    {/* Name */}
                    <td className="px-5 py-4 align-middle">
                      <div className="max-w-[210px] truncate font-medium text-[var(--color-text)]">
                        {u.name || "—"}
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-5 py-4 align-middle">
                      <span
                        dir="ltr"
                        className="block whitespace-nowrap text-right text-[var(--color-text-muted)]"
                      >
                        {u.phone || "—"}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4 text-center align-middle">
                      <span
                        className={`inline-flex min-w-[78px] justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                          u.role === "ADMIN"
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-blue-500/10 text-blue-500"
                        }`}
                      >
                        {u.role === "ADMIN" ? "ادمین" : "منیجر"}
                      </span>
                    </td>

                    {/* Change Role */}
                    <td className="px-4 py-4 align-middle">
                      <div className="w-[130px]">
                        <Select
                          styles={{
                            ...selectStyles,
                            control: (base, state) => ({
                              ...selectStyles.control?.(base, state),
                              minHeight: "36px",
                              height: "36px",
                            }),
                          }}
                          menuPortalTarget={
                            typeof window !== "undefined"
                              ? document.body
                              : null
                          }
                          menuPosition="fixed"
                          menuPlacement="auto"
                          isSearchable={false}
                          isDisabled={updating === u.id}
                          options={[
                            {
                              value: "MANAGER",
                              label: "منیجر",
                            },
                            {
                              value: "CUSTOMER",
                              label: "کاربر عادی",
                            },
                          ]}
                          value={{
                            value: u.role,
                            label:
                              u.role === "ADMIN"
                                ? "ادمین"
                                : "منیجر",
                          }}
                          onChange={(option) =>
                            changeRole(u.id, option?.value)
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
