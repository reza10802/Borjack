"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { selectStyles } from "@/components/ui/selectStyles";

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(null);
  const [search, setSearch] = useState("");
  const router = useRouter();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/users?role=staff");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      setStaff(data.users);
    } finally {
      setLoading(false);
    }
  }

  const filteredStaff = staff.filter((u) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return (
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q)
    );
  });

  async function changeRole(userId, role) {
    setUpdating(userId);
    setError("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          مدیریت کارکنان
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {filteredStaff.length} کارمند
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="card mb-6 p-4">
        <input
          type="text"
          placeholder="جستجوی کارکنان..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className=" w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition "
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            کارمندی پیدا نشد
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-5 py-4 text-right font-semibold">نام</th>
                <th className="px-5 py-4 text-right font-semibold">شماره</th>
                <th className="px-5 py-4 text-right font-semibold">نقش</th>
                <th className="px-5 py-4 text-right font-semibold">تغییر نقش</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredStaff.map((u) => (
                <tr
                  key={u.id}
                  className="transition hover:bg-[var(--color-surface-2)]"
                >
                  <td className="px-5 py-4 font-medium text-[var(--color-text)]">
                    {u.name}
                  </td>

                  <td className="px-5 py-4 text-[var(--color-text-muted)]">
                    {u.phone}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${u.role === "ADMIN"
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-blue-500/10 text-blue-500"
                        }`}
                    >
                      {u.role === "ADMIN" ? "ادمین" : "منیجر"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="w-44">
                      <Select
                        styles={selectStyles}
                        menuPortalTarget={document.body}
                        isDisabled={updating === u.id}
                        options={[
                          { value: "MANAGER", label: "منیجر" },
                          { value: "CUSTOMER", label: "کاربر عادی" },
                        ]}
                        value={{
                          value: u.role,
                          label: u.role === "ADMIN" ? "ادمین" : "منیجر",
                        }}
                        onChange={(option) => changeRole(u.id, option.value)}
                      />
                    </div>
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