"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const priorityConfig = {
    HIGH: { label: "بالا", color: "bg-red-100 text-red-700" },
    MEDIUM: { label: "متوسط", color: "bg-yellow-100 text-yellow-700" },
    LOW: { label: "کم", color: "bg-green-100 text-green-700" },
};

export default function AdminDashboard() {
    const { user } = useAuth();

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState("");

    const [filter, setFilter] = useState("received");
    const [users, setUsers] = useState([]);

    const [showNewTask, setShowNewTask] = useState(false);
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        priority: "MEDIUM",
        toId: "",
    });

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let ignore = false;

        async function loadStats() {
            try {
                const res = await fetch("/api/admin/stats");
                const data = await res.json().catch(() => ({}));

                if (!ignore && res.ok) {
                    setStats(data);
                }
            } catch {
            } finally {
                if (!ignore) setStatsLoading(false);
            }
        }

        loadStats();

        return () => {
            ignore = true;
        };
    }, []);

    useEffect(() => {
        let ignore = false;

        async function loadUsers() {
            if (!user) return;

            if (user.role !== "ADMIN") {
                setUsers([]);
                return;
            }

            try {
                const res = await fetch("/api/admin/users");
                const data = await res.json().catch(() => ({}));

                if (!ignore && res.ok) {
                    setUsers((data.users || []).filter((u) => u.role !== "CUSTOMER"));
                }
            } catch {
                if (!ignore) setUsers([]);
            }
        }

        loadUsers();

        return () => {
            ignore = true;
        };
    }, [user]);

    useEffect(() => {
        let ignore = false;

        async function loadTasks() {
            setTasksLoading(true);
            setTasksError("");

            try {
                const res = await fetch(`/api/admin/tasks?filter=${filter}`);
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    if (!ignore) {
                        setTasks([]);
                        setTasksError(data.error || "خطا در دریافت تسک‌ها");
                    }
                    return;
                }

                if (!ignore) {
                    setTasks(data.tasks || []);
                }
            } catch {
                if (!ignore) {
                    setTasks([]);
                    setTasksError("خطا در ارتباط با سرور");
                }
            } finally {
                if (!ignore) setTasksLoading(false);
            }
        }

        loadTasks();

        return () => {
            ignore = true;
        };
    }, [filter]);

    const toggleDone = async (task) => {
        try {
            const res = await fetch(`/api/admin/tasks/${task.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ done: !task.done }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;

            setTasks((prev) =>
                prev.map((t) => (t.id === data.task.id ? data.task : t))
            );
        } catch { }
    };

    const deleteTask = async (id) => {
        try {
            const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
            if (!res.ok) return;

            setTasks((prev) => prev.filter((t) => t.id !== id));
        } catch { }
    };

    const createTask = async () => {
        if (!newTask.title.trim()) return;
        if (!newTask.toId) return;

        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTask),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) return;

            setTasks((prev) => [data.task, ...prev]);
            setNewTask({
                title: "",
                description: "",
                priority: "MEDIUM",
                toId: "",
            });
            setShowNewTask(false);
        } finally {
            setSubmitting(false);
        }
    };

    const statCards = stats
        ? [
            { label: "کل کالاها", value: stats.products, icon: "📦" },
            { label: "سفارشات امروز", value: stats.todayOrders, icon: "🛒" },
            { label: "کاربران", value: stats.users, icon: "👥" },
            { label: "ناموجود", value: stats.outOfStock, icon: "⚠️" },
        ]
        : [];

    return (
        <div dir="rtl" className="max-w-7xl mx-auto">
            <h1 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">
                خوش آمدید، {user?.name} 👋
            </h1>

            {/* آمار */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {statsLoading
                    ? [...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className="bg-white rounded-xl p-4 animate-pulse h-24 border border-gray-100"
                        />
                    ))
                    : statCards.map((card) => (
                        <div
                            key={card.label}
                            className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4"
                        >
                            <div className="flex flex-col items-center justify-between sm:flex-col sm:justify-center sm:items-center sm:text-center sm:gap-2">
                                <div className="text-xl sm:text-2xl">{card.icon}</div>

                                <div className="text-xl sm:text-2xl font-bold text-gray-800 leading-none">
                                    {card.value}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                                    {card.label}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>

            {/* تسک‌ها */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                    <h2 className="text-base sm:text-lg font-bold text-gray-800">تسک‌ها</h2>

                    {user?.role === "ADMIN" && (
                        <button
                            onClick={() => setShowNewTask((s) => !s)}
                            className="w-full sm:w-auto px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition"
                        >
                            + تسک جدید
                        </button>
                    )}
                </div>

                {user?.role === "ADMIN" && showNewTask && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-5 flex flex-col gap-3">
                        <input
                            type="text"
                            placeholder="عنوان تسک"
                            value={newTask.title}
                            onChange={(e) =>
                                setNewTask((t) => ({ ...t, title: e.target.value }))
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                        />

                        <textarea
                            placeholder="توضیحات (اختیاری)"
                            value={newTask.description}
                            onChange={(e) =>
                                setNewTask((t) => ({ ...t, description: e.target.value }))
                            }
                            rows={2}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <select
                                value={newTask.priority}
                                onChange={(e) =>
                                    setNewTask((t) => ({ ...t, priority: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                            >
                                <option value="HIGH">اولویت بالا</option>
                                <option value="MEDIUM">اولویت متوسط</option>
                                <option value="LOW">اولویت کم</option>
                            </select>

                            <select
                                value={newTask.toId}
                                onChange={(e) =>
                                    setNewTask((t) => ({ ...t, toId: e.target.value }))
                                }
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                            >
                                <option value="">انتخاب گیرنده</option>
                                {users
                                    .filter((u) => u.id !== user?.id)
                                    .map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.name} ({u.role})
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                onClick={() => setShowNewTask(false)}
                                className="w-full sm:w-auto px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                            >
                                انصراف
                            </button>
                            <button
                                onClick={createTask}
                                disabled={submitting}
                                className="w-full sm:w-auto px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                            >
                                {submitting ? "در حال ارسال..." : "ارسال"}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { id: "received", label: "دریافتی" },
                        { id: "sent", label: "ارسالی" },
                        { id: "all", label: "همه" },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2 rounded-lg text-sm transition ${filter === f.id
                                    ? "bg-black text-white"
                                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {tasksError && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                        {tasksError}
                    </div>
                )}

                {tasksLoading ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        در حال بارگذاری...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        تسکی وجود ندارد
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={`rounded-xl border p-4 transition ${task.done
                                        ? "bg-gray-50 border-gray-100 opacity-70"
                                        : "bg-white border-gray-200"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => toggleDone(task)}
                                        className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center transition ${task.done
                                                ? "bg-black border-black"
                                                : "border-gray-300 hover:border-black"
                                            }`}
                                    >
                                        {task.done && (
                                            <svg
                                                className="w-3 h-3 text-white"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={3}
                                                    d="M5 13l4 4L19 7"
                                                />
                                            </svg>
                                        )}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 mb-1">
                                            <span
                                                className={`text-sm font-medium break-words ${task.done
                                                        ? "line-through text-gray-400"
                                                        : "text-gray-800"
                                                    }`}
                                            >
                                                {task.title}
                                            </span>

                                            <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig[task.priority]?.color}`}
                                            >
                                                {priorityConfig[task.priority]?.label}
                                            </span>
                                        </div>

                                        {task.description && (
                                            <p className="text-xs sm:text-sm text-gray-500 mb-2 break-words">
                                                {task.description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-gray-400">
                                            <span>از: {task.from?.name}</span>
                                            <span className="hidden sm:inline">←</span>
                                            <span>به: {task.to?.name}</span>
                                            <span>·</span>
                                            <span>
                                                {new Date(task.createdAt).toLocaleDateString("fa-IR")}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => deleteTask(task.id)}
                                        className="text-gray-300 hover:text-red-500 transition text-lg shrink-0"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}