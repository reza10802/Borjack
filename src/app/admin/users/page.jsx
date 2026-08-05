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
  CUSTOMER:
    "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",

  ADMIN:
    "bg-[var(--color-accent)] text-white",

  MANAGER:
    "bg-blue-500/10 text-blue-500",
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          مدیریت کاربران
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {filteredUsers.length} کاربر
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
          placeholder="جستجوی نام یا شماره موبایل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition"
        />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            کاربری یافت نشد
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-4 text-right font-semibold">نام</th>
                <th className="px-4 py-4 text-right font-semibold">شناسه</th>
                <th className="px-4 py-4 text-right font-semibold">سفارشات</th>
                <th className="px-4 py-4 text-right font-semibold">نقش</th>
                <th className="px-4 py-4 text-right font-semibold">وضعیت</th>
                <th className="px-4 py-4 text-right font-semibold">عملیات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredUsers.map((u) => {
                const isSelf = u.id === me?.id;
                const isAdmin = u.role === "ADMIN";

                return (
                  <tr className="transition hover:bg-[var(--color-surface-2)]">
                    <td className="px-4 py-4 font-medium text-[var(--color-text)]">{u.name}</td>
                    <td className="px-4 py-4 text-xs text-[var(--color-text-muted)]">{u.phone}</td>
                    <td className="px-4 py-4 text-[var(--color-text)]">{u._count?.orders ?? 0}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="text-green-500 font-medium">
                          فعال
                        </span>
                      ) : (
                        <span className="text-red-500 font-medium">
                          مسدود
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          حساب شما
                        </span>
                      ) : isAdmin ? (
                        <span className="text-xs text-[var(--color-text-muted)]">
                          ادمین اصلی
                        </span>
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
                              ? "h-9 px-4 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition text-xs"
                              : "h-9 px-4 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500/20 transition text-xs"
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
          <div className="space-y-3 text-sm text-[var(--color-text)]">

            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                نام
              </span>

              <span className="text-[var(--color-text-muted)]">
                {selectedUser.name}
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                شماره تلفن
              </span>

              <span className="text-[var(--color-text-muted)]">
                {selectedUser.phone}
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                نقش
              </span>

              <span className="text-[var(--color-text-muted)]">
                {ROLE_LABELS[selectedUser.role]}
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                وضعیت:
              </span>

              <span className="text-[var(--color-text-muted)]">
                {selectedUser.isActive ? "فعال" : "مسدود"}
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                تعداد سفارش:
              </span>

              <span className="text-[var(--color-text-muted)]">
                {selectedUser._count.orders}
              </span>
            </div>

            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold text-[var(--color-text)]">
                تاریخ عضویت:
              </span>

              <span className="text-[var(--color-text-muted)]">
                {new Date(selectedUser.createdAt).toLocaleDateString("fa-IR")}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}