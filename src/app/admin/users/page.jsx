
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import Modal from "@/components/ui/Modal";
import Select from "react-select";
import { selectStyles } from "@/components/ui/selectStyles";

const ROLE_LABELS = {
  CUSTOMER: "مشتری",
  ADMIN: "ادمین",
  SUPPLIER: "تأمین‌کننده",
};

const ROLE_COLORS = {
  CUSTOMER:
    "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]",
  ADMIN:
    "bg-[var(--color-accent)] text-white",
  SUPPLIER:
    "bg-blue-500/10 text-blue-500",
};

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const { showConfirm, showToast } = useUI();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState("");
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

  // دریافت کاربران
  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;

    async function loadUsers() {
      try {
        const res = await fetch("/api/admin/users", {
          cache: "no-store",
          signal: controller.signal,
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت کاربران"
          );
        }

        if (!ignore) {
          setUsers(
            Array.isArray(data.users)
              ? data.users
              : []
          );

          setError("");
        }
      } catch (error) {
        if (
          ignore ||
          error.name === "AbortError"
        ) {
          return;
        }

        console.error("LOAD USERS ERROR:", error);

        setError(
          error.message || "خطا در ارتباط با سرور"
        );

        setUsers([]);
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, []);

  // ارسال درخواست تغییر نقش یا وضعیت کاربر
  // در صورت نیاز، ابتدا تأیید مجدد ادمین دریافت می‌شود.
  const sendUserChange = async (userId, method, payload) => {
    let confirmedArchive = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `/api/admin/users/${userId}`,
        {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            confirm: confirmedArchive,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (
        res.status === 409 &&
        data.requiresConfirmation &&
        !confirmedArchive
      ) {
        const shouldContinue = await showConfirm({
          title: "تأیید عملیات و آرشیو محصولات",
          description:
            data.error ||
            "این عملیات ممکن است باعث آرشیو محصولات کاربر شود. آیا ادامه می‌دهید؟",
          confirmText: "ادامه عملیات",
          cancelText: "انصراف",
          danger: true,
        });

        if (!shouldContinue) {
          return { cancelled: true };
        }

        confirmedArchive = true;
        continue;
      }

      return { res, data };
    }

    return { cancelled: true };
  };

  // تغییر نقش کاربر
  const changeRole = async (userId, role) => {
    if (!role || updating !== null || toggling !== null) {
      return;
    }

    const target = users.find((u) => u.id === userId);

    if (!target || target.role === role) return;

    const confirmed = await showConfirm({
      title: "تغییر نقش کاربر",
      description:
        `نقش «${target.name || "کاربر"}» از ` +
        `${ROLE_LABELS[target.role] ?? target.role} به ` +
        `${ROLE_LABELS[role] ?? role} تغییر کند؟`,
      confirmText: "تغییر نقش",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    setUpdating(userId);
    setError("");

    try {
      const result = await sendUserChange(
        userId,
        "PATCH",
        { role }
      );

      if (result.cancelled) return;

      const { res, data } = result;

      if (!res.ok) {
        setError(data.error || "خطا در تغییر نقش");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? data.user : u
        )
      );

      setSelectedUser((prev) =>
        prev?.id === userId ? data.user : prev
      );

      showToast(
        data.message || "نقش کاربر با موفقیت تغییر کرد.",
        { type: "success" }
      );
    } catch (error) {
      console.error("CHANGE ROLE ERROR:", error);
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  // تغییر وضعیت فعال یا مسدود بودن کاربر
  const toggleUserStatus = async (userId, isActive) => {
    if (toggling !== null || updating !== null) {
      return;
    }

    setToggling(userId);
    setError("");

    try {
      const result = await sendUserChange(
        userId,
        "PUT",
        { isActive }
      );

      if (result.cancelled) return;

      const { res, data } = result;

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? data.user : u
        )
      );

      setSelectedUser((prev) =>
        prev?.id === userId ? data.user : prev
      );

      showToast(
        isActive
          ? "حساب کاربر با موفقیت فعال شد."
          : "حساب کاربر با موفقیت مسدود شد.",
        { type: "success" }
      );
    } catch (error) {
      console.error("TOGGLE USER STATUS ERROR:", error);
      setError("خطا در ارتباط با سرور");
    } finally {
      setToggling(null);
    }
  };

  // نمایش اطلاعات کاربر
  const openUserModal = (user) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  // بستن اطلاعات کاربر
  const closeUserModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          مدیریت کاربران
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {filteredUsers.length.toLocaleString("fa-IR")} کاربر
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Search */}
      <div className="card mb-6 p-4">
        <input
          type="text"
          placeholder="جستجوی نام یا شماره موبایل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="card min-w-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            در حال بارگذاری...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center text-[var(--color-text-muted)]">
            کاربری یافت نشد
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-sm">
              <colgroup>
                <col className="w-[180px]" />
                <col className="w-[170px]" />
                <col className="w-[100px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[390px]" />
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
                    سفارشات
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-center font-semibold text-[var(--color-text-muted)]">
                    نقش
                  </th>

                  <th className="border-b border-[var(--color-border)] px-4 py-4 text-center font-semibold text-[var(--color-text-muted)]">
                    وضعیت
                  </th>

                  <th className="border-b border-[var(--color-border)] px-5 py-4 text-right font-semibold text-[var(--color-text-muted)]">
                    عملیات
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === me?.id;
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      {/* Name */}
                      <td className="px-5 py-4 align-middle">
                        <div className="max-w-[160px] truncate font-medium text-[var(--color-text)]">
                          {u.name || "—"}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4 align-middle">
                        <span
                          dir="ltr"
                          className="block text-right whitespace-nowrap text-[var(--color-text-muted)]"
                        >
                          {u.phone || "—"}
                        </span>
                      </td>

                      {/* Orders */}
                      <td className="px-4 py-4 text-center align-middle">
                        <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-[var(--color-surface-2)] px-2 text-xs font-medium text-[var(--color-text)]">
                          {u._count?.orders ?? 0}
                        </span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-4 text-center align-middle">
                        <span
                          className={`inline-flex min-w-[72px] justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                            ROLE_COLORS[u.role] ||
                            "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                          }`}
                        >
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center align-middle">
                        <span
                          className={`inline-flex min-w-[72px] justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                            u.isActive
                              ? "bg-green-500/10 text-green-500"
                              : "bg-red-500/10 text-red-500"
                          }`}
                        >
                          {u.isActive ? "فعال" : "مسدود"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 align-middle">
                        <div className="flex min-w-max items-center gap-2.5">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => openUserModal(u)}
                            className="h-9 w-[110px] shrink-0 rounded-lg border border-[var(--color-border)] px-3 text-xs text-[var(--color-text)] transition hover:bg-[var(--color-surface-2)]"
                          >
                            مشاهده
                          </button>

                          {!isSelf && !isAdmin ? (
                            <div className="flex align-middle gap-4.5">
                              {/* Role select */}
                              <div className="w-[130px] shrink-0">
                                <Select
                                  value={{
                                    value: u.role,
                                    label: ROLE_LABELS[u.role],
                                  }}
                                  onChange={(option) =>
                                    changeRole(u.id, option?.value)
                                  }
                                  options={[
                                    {
                                      value: "CUSTOMER",
                                      label: "مشتری",
                                    },
                                    {
                                      value: "SUPPLIER",
                                      label: "تأمین‌کننده",
                                    },
                                  ]}
                                  isDisabled={
                                    updating === u.id ||
                                    toggling === u.id
                                  }
                                  styles={{
                                    ...selectStyles,
                                    control: (base, state) => ({
                                      ...selectStyles.control?.(base, state),
                                      minHeight: "36px",
                                      height: "36px",
                                    }),
                                  }}
                                  isSearchable={false}
                                  menuPlacement="auto"
                                />
                              </div>

                              {/* Status button */}
                              <button
                                type="button"
                                onClick={() =>
                                  toggleUserStatus(u.id, !u.isActive)
                                }
                                disabled={
                                  toggling === u.id ||
                                  updating === u.id
                                }
                                className={`h-9 shrink-0 rounded-lg px-4 text-xs text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                  u.isActive
                                    ? "bg-red-500 hover:bg-red-600"
                                    : "bg-green-500 hover:bg-green-600"
                                }`}
                              >
                                {toggling === u.id
                                  ? "..."
                                  : u.isActive
                                    ? "مسدود کردن"
                                    : "فعال کردن"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {isSelf
                                ? "حساب فعلی"
                                : "تغییرات این ادمین محدود است"}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Modal */}
      <Modal
        open={showModal}
        onClose={closeUserModal}
        title="اطلاعات کاربر"
      >
        {selectedUser && (
          <div className="space-y-3 text-sm text-[var(--color-text)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">نام</span>
              <span className="text-left text-[var(--color-text-muted)]">
                {selectedUser.name || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">شماره تلفن</span>
              <span
                dir="ltr"
                className="text-left text-[var(--color-text-muted)]"
              >
                {selectedUser.phone || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">نقش</span>
              <span className="text-[var(--color-text-muted)]">
                {ROLE_LABELS[selectedUser.role] || selectedUser.role}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">وضعیت</span>
              <span className="text-[var(--color-text-muted)]">
                {selectedUser.isActive ? "فعال" : "مسدود"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">تعداد سفارش</span>
              <span className="text-[var(--color-text-muted)]">
                {selectedUser._count?.orders ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <span className="font-semibold">تاریخ عضویت</span>
              <span className="text-[var(--color-text-muted)]">
                {selectedUser.createdAt
                  ? new Date(
                      selectedUser.createdAt
                    ).toLocaleDateString("fa-IR")
                  : "—"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
