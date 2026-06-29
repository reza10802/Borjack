"use client";

import { useState, useEffect } from "react";

const ROLE_LABELS = {
    CUSTOMER: "مشتری",
    MANAGER: "کارمند",
    ADMIN: "مدیر اصلی",
};

export default function AdminStaffPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [error, setError] = useState("");

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) setUsers(await res.json());
        } finally {
            setLoading(false);
        }
    };

    const toggleManager = async (user) => {
        setError("");
        const newRole = user.role === "MANAGER" ? "CUSTOMER" : "MANAGER";
        setUpdatingId(user.id);
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "خطا در تغییر نقش");
                return;
            }
            setUsers(users.map(u => u.id === user.id ? data : u));
        } finally {
            setUpdatingId(null);
        }
    };

    if (loading) return <p className="text-sm text-gray-400">در حال بارگذاری...</p>;

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
                می‌تونی هر مشتری رو به «کارمند» (نقش MANAGER) ارتقا بدی یا ازش پس بگیری. ارتقا به مدیر اصلی فقط دستی از دیتابیس ممکنه.
            </p>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {users.map((u, i) => (
                    <div key={u.id}
                        className={`flex items-center gap-4 px-5 py-3 ${i !== users.length - 1 ? "border-b border-gray-100" : ""}`}>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-gray-800">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.identifier}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-lg ${
                            u.role === "ADMIN" ? "bg-black text-white"
                            : u.role === "MANAGER" ? "bg-blue-100 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                            {ROLE_LABELS[u.role] || u.role}
                        </span>
                        {u.role !== "ADMIN" && (
                            <button
                                onClick={() => toggleManager(u)}
                                disabled={updatingId === u.id}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                {u.role === "MANAGER" ? "پس گرفتن دسترسی" : "ارتقا به کارمند"}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}