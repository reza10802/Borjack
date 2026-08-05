"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Select from "react-select";

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
        <div
            dir="rtl"
            className="max-w-7xl mx-auto min-h-full text-[var(--color-primary)] transition-colors"
        >
            <h1 className="text-lg sm:text-xl font-bold text-[var(--color-primary)] dark:text-white mb-4 sm:mb-6">
                خوش آمدید، {user?.name} 👋
            </h1>

            {/* آمار */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                {statsLoading
                    ? [...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className="card animate-pulse h-24 bg-[var(--background-card)]" />
                    ))
                    : statCards.map((card) => (
                        <div
                            key={card.label}
                            className=" card hover:shadow-lg hover:-translate-y-1 transition-all "
                        >
                            <div className="flex flex-col items-center justify-between sm:flex-col sm:justify-center sm:items-center sm:text-center sm:gap-2">
                                <div className="text-xl sm:text-2xl">{card.icon}</div>

                                <div className="text-xl sm:text-2xl font-bold text-[var(--color-primary)] dark:text-white leading-none">
                                    {card.value}
                                </div>
                                <div className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                                    {card.label}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>

            {/* تسک‌ها */}
            <div className="card p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--color-primary)] dark:text-white">تسک‌ها</h2>

                    {user?.role === "ADMIN" && (
                        <button
                            onClick={() => setShowNewTask((s) => !s)}
                            className="w-full sm:w-auto px-4 py-2 btn-primary text-sm rounded-xl hover:bg-gray-800 transition"
                        >
                            + تسک جدید
                        </button>
                    )}
                </div>

                {user?.role === "ADMIN" && showNewTask && (
                    <div className="card p-4 mb-5 flex flex-col gap-3 border border-[var(--color-border)]">
                        <input
                            type="text"
                            placeholder="عنوان تسک"
                            value={newTask.title}
                            onChange={(e) =>
                                setNewTask((t) => ({ ...t, title: e.target.value }))
                            }
                            className=" w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] text-[var(--color-primary)] dark:text-white  focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] "
                        />

                        <textarea
                            placeholder="توضیحات (اختیاری)"
                            value={newTask.description}
                            onChange={(e) =>
                                setNewTask((t) => ({ ...t, description: e.target.value }))
                            }
                            rows={2}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] text-[var(--color-primary)] placeholder:text-zinc-500 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)] transition"
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select
                                options={[
                                    { value: "HIGH", label: "اولویت بالا" },
                                    { value: "MEDIUM", label: "اولویت متوسط" },
                                    { value: "LOW", label: "اولویت کم" },
                                ]}
                                value={{
                                    value: newTask.priority,
                                    label:
                                        newTask.priority === "HIGH"
                                            ? "اولویت بالا"
                                            : newTask.priority === "MEDIUM"
                                                ? "اولویت متوسط"
                                                : "اولویت کم",
                                }}
                                onChange={(option) =>
                                    setNewTask((t) => ({
                                        ...t,
                                        priority: option.value,
                                    }))
                                }
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        backgroundColor: "var(--background-card)",
                                        borderColor: "var(--color-border)",
                                        color: "var(--color-primary)",
                                        boxShadow: "none",
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor: "var(--background-card)",
                                    }),
                                    menuList: (base) => ({
                                        ...base,
                                        backgroundColor: "var(--background-card)",
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color: "var(--color-primary)",
                                    }),
                                    input: (base) => ({
                                        ...base,
                                        color: "var(--color-primary)",
                                    }),
                                    placeholder: (base) => ({
                                        ...base,
                                        color: "#888",
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isFocused
                                            ? "var(--color-accent)"
                                            : "var(--background-card)",
                                        color: state.isFocused ? "#fff" : "var(--color-primary)",
                                    }),
                                }}
                            />

                            <Select
                                options={users
                                    .filter((u) => u.id !== user?.id)
                                    .map((u) => ({
                                        value: u.id,
                                        label: `${u.name} (${u.role})`,
                                    }))}
                                value={
                                    users
                                        .filter((u) => u.id !== user?.id)
                                        .map((u) => ({
                                            value: u.id,
                                            label: `${u.name} (${u.role})`,
                                        }))
                                        .find((u) => u.value === newTask.toId) || null
                                }
                                onChange={(option) =>
                                    setNewTask((t) => ({
                                        ...t,
                                        toId: option?.value || "",
                                    }))
                                }
                                placeholder="انتخاب گیرنده"
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        backgroundColor: "var(--background-card-rgb)",
                                        borderColor: "var(--color-border)",
                                        boxShadow: "none",
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor: "var(--background-card-rgb)",
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color: "var(--color-primary)",
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor: state.isFocused
                                            ? "var(--color-accent)"
                                            : "transparent",
                                        color: state.isFocused ? "#fff" : "var(--color-primary)",
                                    }),
                                }}
                            />
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                            <button
                                onClick={() => setShowNewTask(false)}
                                className="px-4 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] text-[var(--color-primary)] dark:text-white hover:bg-[var(--background-app)] transition"                            >
                                انصراف
                            </button>
                            <button
                                onClick={createTask}
                                disabled={submitting}
                                className="w-full sm:w-auto px-4 py-2 text-sm btn-primary rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
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
                                ? "bg-[var(--color-primary)] text-white"
                                : "card hover:border-[var(--color-accent)]"
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {tasksError && (
                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">                        {tasksError}
                    </div>
                )}

                {tasksLoading ? (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        در حال بارگذاری...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
                        تسکی وجود ندارد
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={`card p-4 border border-[var(--color-border)] transition-colors ${task.done
                                    ? "opacity-70 border-[var(--color-border)]"
                                    : "hover:border-[var(--color-accent)]"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <button
                                        onClick={() => toggleDone(task)}
                                        className={`w-5 h-5 rounded-full border-2 shrink-0 mt-1 flex items-center justify-center transition ${task.done
                                            ? "bg-[var(--color-accent)] border-[var(--color-accent)]"
                                            : "border-gray-300 hover:border-[var(--color-accent)]"
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
                                                    : "text-[var(--color-primary)] dark:text-white"
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
                                            <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-2 break-words">
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
                                        className="text-zinc-400 hover:text-red-500 transition text-lg shrink-0"                                    >
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