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
      <h1 className="text-xl font-bold text-gray-800 mb-6">
        مدیریت کارکنان
      </h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
        <input
          type="text"
          placeholder="جستجوی کارکنان..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">
            در حال بارگذاری...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            کارمندی پیدا نشد
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3">نام</th>
                <th className="px-4 py-3">شماره</th>
                <th className="px-4 py-3">نقش</th>
                <th className="px-4 py-3">تغییر نقش</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredStaff.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                  </td>

                  <td className="px-4 py-3 text-gray-500">
                    {u.phone}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${u.role === "ADMIN"
                        ? "bg-black text-white"
                        : "bg-blue-100 text-blue-700"
                        }`}
                    >
                      {u.role === "ADMIN" ? "ادمین" : "منیجر"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
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
                        label:
                          u.role === "ADMIN"
                            ? "ادمین"
                            : "منیجر",
                      }}
                      onChange={(option) =>
                        changeRole(u.id, option.value)
                      }
                    />
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