"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Modal from "@/components/ui/Modal";
import Select from "react-select";
import { selectStyles } from "@/components/ui/selectStyles";

const ROLE_LABELS = {
  CUSTOMER: "مشتری",
  ADMIN: "ادمین",
  MANAGER: "منیجر",
};

const ROLE_COLORS = {
  CUSTOMER: "bg-gray-100 text-gray-600",
  ADMIN: "bg-black text-white",
  MANAGER: "bg-blue-100 text-blue-700",
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return (
      u.name?.toLowerCase().includes(q) ||
      u.phone?.includes(q)
    );
  });

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت کاربران");
        setUsers([]);
        return;
      }

      setUsers(data.users || []);
    } catch {
      setError("خطا در ارتباط با سرور");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeRole = async (userId, role) => {
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

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  const toggleUserStatus = async (userId, isActive) => {
    setToggling(userId);
    setError("");

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? data.user : u))
      );
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">مدیریت کاربران</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="mb-5">
        <input
          type="text"
          placeholder="جستجوی نام یا شماره موبایل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-black/20"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">کاربری یافت نشد</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">شناسه</th>
                <th className="px-4 py-3 font-medium">سفارشات</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((u) => {
                const isSelf = u.id === me?.id;
                const isAdmin = u.role === "ADMIN";

                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{u.phone}</td>
                    <td className="px-4 py-3 text-gray-600">{u._count?.orders ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="text-green-600">فعال</span>
                      ) : (
                        <span className="text-red-600">مسدود</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-gray-400">حساب شما</span>
                      ) : isAdmin ? (
                        <span className="text-xs text-gray-400">ادمین اصلی</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowModal(true);
                            }}
                            className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs"
                          >
                            جزئیات
                          </button>
                          <Select
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                            isDisabled={updating === u.id}
                            options={[
                              { value: "CUSTOMER", label: "کاربر عادی" },
                              { value: "MANAGER", label: "منیجر" },
                            ]}
                            value={{
                              value: u.role,
                              label:
                                u.role === "CUSTOMER"
                                  ? "کاربر عادی"
                                  : "منیجر",
                            }}
                            onChange={(option) =>
                              changeRole(u.id, option.value)
                            }
                          />
                          <button
                            onClick={() => toggleUserStatus(u.id, !u.isActive)}
                            disabled={toggling === u.id}
                            className={`px-3 py-1 rounded-lg text-xs transition ${u.isActive
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                              }`}

                          >
                            {toggling === u.id
                              ? "..."
                              : u.isActive
                                ? "مسدود کردن"
                                : "فعال کردن"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="اطلاعات کاربر"
      >
        {selectedUser && (
          <div className="space-y-3 text-sm">

            <div>
              <span className="font-bold">نام:</span>{" "}
              {selectedUser.name}
            </div>

            <div>
              <span className="font-bold">شماره:</span>{" "}
              {selectedUser.phone}
            </div>

            <div>
              <span className="font-bold">نقش:</span>{" "}
              {ROLE_LABELS[selectedUser.role]}
            </div>

            <div>
              <span className="font-bold">وضعیت:</span>{" "}
              {selectedUser.isActive ? "فعال" : "مسدود"}
            </div>

            <div>
              <span className="font-bold">تعداد سفارش:</span>{" "}
              {selectedUser._count.orders}
            </div>

            <div>
              <span className="font-bold">تاریخ عضویت:</span>{" "}
              {new Date(selectedUser.createdAt).toLocaleDateString("fa-IR")}
            </div>

          </div>
        )}
      </Modal>
    </div>
  );
}