"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Select from "react-select";

const priorityConfig = {
    HIGH: {
        label: "بالا",
        color: "bg-red-500/10 text-red-500",
    },
    MEDIUM: {
        label: "متوسط",
        color: "bg-yellow-500/10 text-yellow-500",
    },
    LOW: {
        label: "کم",
        color: "bg-green-500/10 text-green-500",
    },
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
                    setUsers(
                        (data.users || []).filter(
                            (u) => u.role !== "CUSTOMER"
                        )
                    );
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
                const res = await fetch(
                    `/api/admin/tasks?filter=${filter}`
                );
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    if (!ignore) {
                        setTasks([]);
                        setTasksError(
                            data.error || "خطا در دریافت تسک‌ها"
                        );
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
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    done: !task.done,
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) return;

            setTasks((prev) =>
                prev.map((t) =>
                    t.id === data.task.id ? data.task : t
                )
            );
        } catch {
        }
    };

    const deleteTask = async (id) => {
        try {
            const res = await fetch(`/api/admin/tasks/${id}`, {
                method: "DELETE",
            });

            if (!res.ok) return;

            setTasks((prev) => prev.filter((t) => t.id !== id));
        } catch {
        }
    };

    const createTask = async () => {
        if (!newTask.title.trim()) return;
        if (!newTask.toId) return;

        setSubmitting(true);

        try {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
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
            {
                label: "کل کالاها",
                value: stats.products,
                icon: "📦",
                href: "/admin/products",
            },
            {
                label: "سفارشات امروز",
                value: stats.todayOrders,
                icon: "🛒",
                href: "/admin/orders",
            },
            {
                label: "کاربران",
                value: stats.users,
                icon: "👥",
                href: "/admin/users",
            },
            {
                label: "ناموجود",
                value: stats.outOfStock,
                icon: "⚠️",
                href: "/admin/products",
            },
        ]
        : [];

    return (
        <div
            dir="rtl"
            className="mx-auto min-h-full max-w-7xl text-[var(--color-text)] transition-colors"
        >
            {/* Welcome */}
            <h1 className="mb-4 text-lg font-bold text-[var(--color-text)] sm:mb-6 sm:text-xl">
                خوش آمدید، {user?.name} 👋
            </h1>

            {/* Stats */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
                {statsLoading
                    ? [...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className="card h-24 animate-pulse bg-[var(--background-card)]"
                        />
                    ))
                    : statCards.map((card) => (
                        <Link
                            key={card.label}
                            href={card.href}
                            className="card block cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 text-center py-2">
                                <div className="text-xl sm:text-2xl">
                                    {card.icon}
                                </div>

                                <div className="text-xl font-bold leading-none text-[var(--color-text)] sm:text-2xl">
                                    {card.value}
                                </div>

                                <div className="mt-1 text-xs text-[var(--color-text-muted)] sm:text-sm">
                                    {card.label}
                                </div>
                            </div>
                        </Link>
                    ))}
            </div>

            {/* Tasks */}
            <div className="card p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-base font-bold text-[var(--color-text)] sm:text-lg">
                        تسک‌ها
                    </h2>

                    {user?.role === "ADMIN" && (
                        <button
                            type="button"
                            onClick={() =>
                                setShowNewTask((s) => !s)
                            }
                            className="btn-primary w-full rounded-xl px-4 py-2 text-sm transition hover:opacity-90 sm:w-auto"
                        >
                            + تسک جدید
                        </button>
                    )}
                </div>

                {/* New Task */}
                {user?.role === "ADMIN" && showNewTask && (
                    <div className="card mb-5 flex flex-col gap-3 border border-[var(--color-border)] p-4">
                        <input
                            type="text"
                            placeholder="عنوان تسک"
                            value={newTask.title}
                            onChange={(e) =>
                                setNewTask((t) => ({
                                    ...t,
                                    title: e.target.value,
                                }))
                            }
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />

                        <textarea
                            placeholder="توضیحات (اختیاری)"
                            value={newTask.description}
                            onChange={(e) =>
                                setNewTask((t) => ({
                                    ...t,
                                    description: e.target.value,
                                }))
                            }
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] transition focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select
                                options={[
                                    {
                                        value: "HIGH",
                                        label: "اولویت بالا",
                                    },
                                    {
                                        value: "MEDIUM",
                                        label: "اولویت متوسط",
                                    },
                                    {
                                        value: "LOW",
                                        label: "اولویت کم",
                                    },
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
                                        priority: option?.value || "MEDIUM",
                                    }))
                                }
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        minHeight: "44px",
                                        backgroundColor:
                                            "var(--background-card)",
                                        borderColor:
                                            "var(--color-border)",
                                        color:
                                            "var(--color-text)",
                                        boxShadow: "none",
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor:
                                            "var(--background-card)",
                                    }),
                                    menuList: (base) => ({
                                        ...base,
                                        backgroundColor:
                                            "var(--background-card)",
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text)",
                                    }),
                                    input: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text)",
                                    }),
                                    placeholder: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text-muted)",
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor:
                                            state.isFocused
                                                ? "var(--color-accent)"
                                                : "var(--background-card)",
                                        color:
                                            state.isFocused
                                                ? "#fff"
                                                : "var(--color-text)",
                                    }),
                                }}
                            />

                            <Select
                                options={users
                                    .filter(
                                        (u) =>
                                            u.id !== user?.id
                                    )
                                    .map((u) => ({
                                        value: u.id,
                                        label: `${u.name} (${u.role})`,
                                    }))}
                                value={
                                    users
                                        .filter(
                                            (u) =>
                                                u.id !== user?.id
                                        )
                                        .map((u) => ({
                                            value: u.id,
                                            label: `${u.name} (${u.role})`,
                                        }))
                                        .find(
                                            (u) =>
                                                u.value ===
                                                newTask.toId
                                        ) || null
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
                                        minHeight: "44px",
                                        backgroundColor:
                                            "var(--background-card)",
                                        borderColor:
                                            "var(--color-border)",
                                        boxShadow: "none",
                                    }),
                                    menu: (base) => ({
                                        ...base,
                                        backgroundColor:
                                            "var(--background-card)",
                                    }),
                                    menuList: (base) => ({
                                        ...base,
                                        backgroundColor:
                                            "var(--background-card)",
                                    }),
                                    singleValue: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text)",
                                    }),
                                    input: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text)",
                                    }),
                                    placeholder: (base) => ({
                                        ...base,
                                        color:
                                            "var(--color-text-muted)",
                                    }),
                                    option: (base, state) => ({
                                        ...base,
                                        backgroundColor:
                                            state.isFocused
                                                ? "var(--color-accent)"
                                                : "var(--background-card)",
                                        color:
                                            state.isFocused
                                                ? "#fff"
                                                : "var(--color-text)",
                                    }),
                                }}
                            />
                        </div>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowNewTask(false)
                                }
                                className="rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-4 py-2 text-sm text-[var(--color-text)] transition hover:bg-[var(--background-app)]"
                            >
                                انصراف
                            </button>

                            <button
                                type="button"
                                onClick={createTask}
                                disabled={submitting}
                                className="btn-primary w-full rounded-lg px-4 py-2 text-sm transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
                            >
                                {submitting
                                    ? "در حال ارسال..."
                                    : "ارسال"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Task Filters */}
                <div className="mb-4 flex flex-wrap gap-2">
                    {[
                        {
                            id: "received",
                            label: "دریافتی",
                        },
                        {
                            id: "sent",
                            label: "ارسالی",
                        },
                        {
                            id: "all",
                            label: "همه",
                        },
                    ].map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => setFilter(f.id)}
                            className={`rounded-lg px-4 py-2 text-sm transition ${
                                filter === f.id
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Task Error */}
                {tasksError && (
                    <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                        {tasksError}
                    </div>
                )}

                {/* Task List */}
                {tasksLoading ? (
                    <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                        در حال بارگذاری...
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                        تسکی وجود ندارد
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tasks.map((task) => (
                            <div
                                key={task.id}
                                className={`card border border-[var(--color-border)] p-4 transition-colors ${
                                    task.done
                                        ? "opacity-70"
                                        : "hover:border-[var(--color-accent)]"
                                }`}
                            >
                                <div className="flex min-w-0 items-start gap-3">
                                    {/* Checkbox */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            toggleDone(task)
                                        }
                                        aria-label={
                                            task.done
                                                ? "بازگرداندن تسک"
                                                : "تکمیل تسک"
                                        }
                                        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                                            task.done
                                                ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
                                                : "border-[var(--color-border)] hover:border-[var(--color-accent)]"
                                        }`}
                                    >
                                        {task.done && (
                                            <svg
                                                className="h-3 w-3 text-white"
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

                                    {/* Content */}
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                            <span
                                                className={`break-words text-sm font-medium ${
                                                    task.done
                                                        ? "text-[var(--color-text-muted)] line-through"
                                                        : "text-[var(--color-text)]"
                                                }`}
                                            >
                                                {task.title}
                                            </span>

                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs ${
                                                    priorityConfig[
                                                        task.priority
                                                    ]?.color
                                                }`}
                                            >
                                                {
                                                    priorityConfig[
                                                        task.priority
                                                    ]?.label
                                                }
                                            </span>
                                        </div>

                                        {task.description && (
                                            <p className="mb-2 break-words text-xs leading-6 text-[var(--color-text-muted)] sm:text-sm">
                                                {task.description}
                                            </p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--color-text-muted)] sm:text-xs">
                                            <span>
                                                از:{" "}
                                                {task.from?.name ||
                                                    "—"}
                                            </span>

                                            <span className="hidden sm:inline">
                                                ←
                                            </span>

                                            <span>
                                                به:{" "}
                                                {task.to?.name ||
                                                    "—"}
                                            </span>

                                            <span>·</span>

                                            <span>
                                                {new Date(
                                                    task.createdAt
                                                ).toLocaleDateString(
                                                    "fa-IR"
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Delete */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            deleteTask(task.id)
                                        }
                                        aria-label="حذف تسک"
                                        className="shrink-0 text-lg text-[var(--color-text-muted)] transition hover:text-red-500"
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
