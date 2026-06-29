"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";

const ROLE_LABELS = { CUSTOMER: "مشتری", ADMIN: "ادمین", MANAGER: "منیجر" };
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

  const load = () => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (userId, role) => {
    setUpdating(userId);
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    setUsers((prev) =>
      prev.map((u) => u.id === userId ? { ...u, role } : u)
    );
    setUpdating(null);
  };

  const deleteUser = async (userId) => {
    if (!confirm("آیا مطمئنید؟ این عمل غیرقابل بازگشت است.")) return;
    await fetch(`/api/admin/users?userId=${userId}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">مدیریت کاربران</h1>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3 font-medium">نام</th>
                <th className="px-4 py-3 font-medium">شناسه</th>
                <th className="px-4 py-3 font-medium">سفارشات</th>
                <th className="px-4 py-3 font-medium">نقش</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{u.identifier}</td>
                  <td className="px-4 py-3 text-gray-600">{u._count?.orders ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== me?.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value)}
                          disabled={updating === u.id}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none disabled:opacity-50"
                        >
                          <option value="CUSTOMER">مشتری</option>
                          <option value="MANAGER">منیجر</option>
                          <option value="ADMIN">ادمین</option>
                        </select>
                        <button
                          onClick={() => deleteUser(u.id)}
                          className="text-red-500 hover:text-red-700 text-xs transition"
                        >
                          حذف
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">حساب شما</span>
                    )}
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