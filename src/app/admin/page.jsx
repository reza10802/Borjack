
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import Select from "react-select";
import Pagination from "@/components/pagination";

const TASKS_PER_PAGE = 10;

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

const statusConfig = {
    TODO: {
        label: "در انتظار",
        color: "bg-gray-500/10 text-gray-500",
    },
    IN_PROGRESS: {
        label: "در حال انجام",
        color: "bg-blue-500/10 text-blue-500",
    },
    COMPLETED: {
        label: "تکمیل‌شده",
        color: "bg-green-500/10 text-green-500",
    },
};

const selectStyles = {
    control: (base) => ({
        ...base,
        minHeight: "44px",
        backgroundColor: "var(--background-card)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
        boxShadow: "none",
    }),
    menu: (base) => ({
        ...base,
        backgroundColor: "var(--background-card)",
        zIndex: 20,
    }),
    menuList: (base) => ({
        ...base,
        backgroundColor: "var(--background-card)",
    }),
    singleValue: (base) => ({
        ...base,
        color: "var(--color-text)",
    }),
    input: (base) => ({
        ...base,
        color: "var(--color-text)",
    }),
    placeholder: (base) => ({
        ...base,
        color: "var(--color-text-muted)",
    }),
    option: (base, state) => ({
        ...base,
        backgroundColor: state.isFocused
            ? "var(--color-accent)"
            : "var(--background-card)",
        color: state.isFocused
            ? "#fff"
            : "var(--color-text)",
    }),
};

function getTaskStatus(task) {
    return task.status || (task.done ? "COMPLETED" : "TODO");
}

function formatDate(value, includeTime = false) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        ...(includeTime
            ? {
                hour: "2-digit",
                minute: "2-digit",
            }
            : {}),
    }).format(date);
}

function toDateTimeLocal(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    date.setMinutes(
        date.getMinutes() - date.getTimezoneOffset()
    );

    return date.toISOString().slice(0, 16);
}

function toIsoDate(value) {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString();
}

export default function AdminDashboard() {
    const { user } = useAuth();
    const { showConfirm, showToast } = useUI();

    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [tasksError, setTasksError] = useState("");

    const [filter, setFilter] = useState("received");
    const [users, setUsers] = useState([]);

    const [showNewTask, setShowNewTask] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [savingTaskId, setSavingTaskId] = useState(null);
    const [deletingTaskId, setDeletingTaskId] = useState(null);
    const [editingTask, setEditingTask] = useState(null);

    const [currentTime, setCurrentTime] = useState(0);

    // Pagination
    const [tasksPage, setTasksPage] = useState(1);

    const [tasksPagination, setTasksPagination] = useState({
        page: 1,
        limit: TASKS_PER_PAGE,
        total: 0,
        totalPages: 1,
    });

    const [tasksReloadKey, setTasksReloadKey] = useState(0);

    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        priority: "MEDIUM",
        toId: "",
        dueAt: "",
    });

    // به‌روزرسانی زمان برای تشخیص تسک‌های دیرکرده
    useEffect(() => {
        let intervalId;

        const timeoutId = window.setTimeout(() => {
            const updateTime = () => {
                setCurrentTime(Date.now());
            };

            updateTime();
            intervalId = window.setInterval(updateTime, 60_000);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);

            if (intervalId) {
                window.clearInterval(intervalId);
            }
        };
    }, []);

    // دریافت آمار داشبورد
    useEffect(() => {
        let ignore = false;

        async function loadStats() {
            try {
                const res = await fetch("/api/admin/stats");
                const data = await res.json().catch(() => ({}));

                if (!ignore && res.ok) {
                    setStats(data);
                }
            } catch (error) {
                console.error("LOAD DASHBOARD STATS ERROR:", error);
            } finally {
                if (!ignore) {
                    setStatsLoading(false);
                }
            }
        }

        loadStats();

        return () => {
            ignore = true;
        };
    }, []);

    // دریافت تأمین‌کنندگان فعال
    useEffect(() => {
        let ignore = false;

        async function loadUsers() {
            if (!user || user.role !== "ADMIN") {
                return;
            }

            try {
                const res = await fetch("/api/admin/users");
                const data = await res.json().catch(() => ({}));

                if (!ignore && res.ok) {
                    setUsers(
                        (data.users || []).filter(
                            (item) =>
                                item.role === "SUPPLIER" &&
                                item.isActive === true
                        )
                    );
                }

                if (!res.ok && !ignore) {
                    console.error(
                        "LOAD SUPPLIERS ERROR:",
                        data.error || res.status
                    );
                }
            } catch (error) {
                console.error("LOAD SUPPLIERS ERROR:", error);

                if (!ignore) {
                    setUsers([]);
                }
            }
        }

        loadUsers();

        return () => {
            ignore = true;
        };
    }, [user]);

    // دریافت صفحه‌ای تسک‌ها
    useEffect(() => {
        let ignore = false;

        async function loadTasks() {
            try {
                const params = new URLSearchParams({
                    filter,
                    page: String(tasksPage),
                    limit: String(TASKS_PER_PAGE),
                });

                const res = await fetch(
                    `/api/admin/tasks?${params.toString()}`,
                    {
                        cache: "no-store",
                    }
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

                    const pagination = data.pagination || {
                        page: 1,
                        limit: TASKS_PER_PAGE,
                        total: 0,
                        totalPages: 1,
                    };

                    setTasksPagination(pagination);

                    // اگر صفحه درخواستی دیگر معتبر نباشد،
                    // شماره صفحه را با پاسخ سرور هماهنگ می‌کنیم.
                    if (pagination.page !== tasksPage) {
                        setTasksPage(pagination.page);
                    }

                    setTasksError("");
                }
            } catch (error) {
                console.error("LOAD TASKS ERROR:", error);

                if (!ignore) {
                    setTasks([]);
                    setTasksError("خطا در ارتباط با سرور");
                }
            } finally {
                if (!ignore) {
                    setTasksLoading(false);
                }
            }
        }

        loadTasks();

        return () => {
            ignore = true;
        };
    }, [filter, tasksPage, tasksReloadKey]);

    // تغییر فیلتر و بازگشت به صفحه اول
    const changeTaskFilter = (nextFilter) => {
        if (filter === nextFilter) return;

        setTasksLoading(true);
        setTasksError("");
        setTasksPage(1);
        setFilter(nextFilter);
    };

    // تغییر صفحه
    const changeTasksPage = (nextPage) => {
        if (
            nextPage === tasksPage ||
            nextPage < 1 ||
            nextPage > tasksPagination.totalPages
        ) {
            return;
        }

        setTasksLoading(true);
        setTasksError("");
        setTasksPage(nextPage);
    };

    // ایجاد تسک
    const createTask = async () => {
        if (!newTask.title.trim()) {
            setTasksError("عنوان تسک را وارد کن.");
            return;
        }

        const selectedSupplier = users.find(
            (item) =>
                item.id === newTask.toId &&
                item.role === "SUPPLIER" &&
                item.isActive === true
        );

        if (!selectedSupplier) {
            setTasksError("یک تأمین‌کننده فعال انتخاب کن.");
            return;
        }

        setSubmitting(true);
        setTasksError("");

        try {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: newTask.title.trim(),
                    description:
                        newTask.description.trim() || null,
                    priority: newTask.priority,
                    toId: newTask.toId,
                    dueAt: toIsoDate(newTask.dueAt),
                }),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setTasksError(
                    data.error || "ساخت تسک انجام نشد."
                );
                return;
            }

            setNewTask({
                title: "",
                description: "",
                priority: "MEDIUM",
                toId: "",
                dueAt: "",
            });

            setShowNewTask(false);

            showToast("تسک با موفقیت ایجاد و ارسال شد.", {
                type: "success",
            });

            // تسک جدید از طرف ادمین ارسال شده است.
            // در فیلتر دریافتی باید به ارسالی برویم.
            setTasksPage(1);
            setTasksLoading(true);

            if (filter === "received") {
                setFilter("sent");
            } else {
                // در فیلتر ارسالی یا همه،
                // همان فیلتر را با داده تازه دریافت می‌کنیم.
                setTasksReloadKey((prev) => prev + 1);
            }
        } catch (error) {
            console.error("CREATE TASK ERROR:", error);
            setTasksError("خطا در ارتباط با سرور");
        } finally {
            setSubmitting(false);
        }
    };

    // تغییر وضعیت تسک
    const updateTaskStatus = async (task, status) => {
        if (!status || status === getTaskStatus(task)) return;

        setSavingTaskId(task.id);
        setTasksError("");

        try {
            const res = await fetch(
                `/api/admin/tasks/${task.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ status }),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setTasksError(
                    data.error || "تغییر وضعیت تسک انجام نشد."
                );
                return;
            }

            setTasks((prev) =>
                prev.map((item) =>
                    item.id === data.task.id ? data.task : item
                )
            );
        } catch (error) {
            console.error("UPDATE TASK STATUS ERROR:", error);
            setTasksError("خطا در ارتباط با سرور");
        } finally {
            setSavingTaskId(null);
        }
    };

    // شروع ویرایش تسک
    const startEditingTask = (task) => {
        setEditingTask({
            id: task.id,
            title: task.title || "",
            description: task.description || "",
            priority: task.priority || "MEDIUM",
            dueAt: toDateTimeLocal(task.dueAt),
        });

        setTasksError("");
    };

    // ذخیره ویرایش تسک
    const saveTask = async () => {
        if (!editingTask) return;

        if (!editingTask.title.trim()) {
            setTasksError("عنوان تسک نمی‌تواند خالی باشد.");
            return;
        }

        setSavingTaskId(editingTask.id);
        setTasksError("");

        try {
            const res = await fetch(
                `/api/admin/tasks/${editingTask.id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        title: editingTask.title.trim(),
                        description:
                            editingTask.description.trim() || null,
                        priority: editingTask.priority,
                        dueAt: toIsoDate(editingTask.dueAt),
                    }),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setTasksError(
                    data.error || "ویرایش تسک انجام نشد."
                );
                return;
            }

            setTasks((prev) =>
                prev.map((task) =>
                    task.id === data.task.id ? data.task : task
                )
            );

            setEditingTask(null);

            showToast("تغییرات تسک ذخیره شد.", {
                type: "success",
            });
        } catch (error) {
            console.error("SAVE TASK ERROR:", error);
            setTasksError("خطا در ارتباط با سرور");
        } finally {
            setSavingTaskId(null);
        }
    };

    // حذف تسک و دریافت مجدد صفحه
    const deleteTask = async (id) => {
        if (deletingTaskId !== null) return;

        const confirmed = await showConfirm({
            title: "حذف وظیفه",
            description: "از حذف این تسک مطمئنی؟ این عملیات قابل بازگشت نیست.",
            confirmText: "حذف تسک",
            cancelText: "انصراف",
            danger: true,
        });

        if (!confirmed) return;

        setDeletingTaskId(id);
        setTasksError("");

        try {
            const res = await fetch(`/api/admin/tasks/${id}`, {
                method: "DELETE",
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setTasksError(
                    data.error || "حذف تسک انجام نشد."
                );
                return;
            }

            if (editingTask?.id === id) {
                setEditingTask(null);
            }

            showToast("تسک با موفقیت حذف شد.", {
                type: "success",
            });

            // پس از حذف، تعداد صفحات و محتوای صفحه
            // دوباره از دیتابیس محاسبه می‌شود.
            setTasksLoading(true);
            setTasksReloadKey((prev) => prev + 1);
        } catch (error) {
            console.error("DELETE TASK ERROR:", error);
            setTasksError("خطا در ارتباط با سرور");
        } finally {
            setDeletingTaskId(null);
        }
    };

    const supplierOptions = users.map((item) => ({
        value: item.id,
        label: item.name || "تأمین‌کننده بدون نام",
    }));

    const priorityOptions = [
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
    ];

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
            <h1 className="mb-4 text-lg font-bold text-[var(--color-text)] sm:mb-6 sm:text-xl">
                خوش آمدید، {user?.name} 👋
            </h1>

            {/* Statistics */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:mb-8 sm:gap-4 lg:grid-cols-4">
                {statsLoading
                    ? [...Array(4)].map((_, index) => (
                        <div
                            key={index}
                            className="card h-24 animate-pulse bg-[var(--background-card)]"
                        />
                    ))
                    : statCards.map((card) => (
                        <Link
                            key={card.label}
                            href={card.href}
                            className="card block cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        >
                            <div className="flex flex-col items-center justify-center gap-2 py-2 text-center">
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
                    <div>
                        <h2 className="text-base font-bold text-[var(--color-text)] sm:text-lg">
                            مدیریت وظایف
                        </h2>

                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            مجموع{" "}
                            {tasksPagination.total.toLocaleString("fa-IR")}
                            {" "}وظیفه
                        </p>
                    </div>

                    {user?.role === "ADMIN" && (
                        <button
                            type="button"
                            onClick={() => {
                                setShowNewTask((current) => !current);
                                setTasksError("");
                            }}
                            className="btn-primary w-full rounded-xl px-4 py-2 text-sm transition hover:opacity-90 sm:w-auto"
                        >
                            + تسک جدید
                        </button>
                    )}
                </div>

                {/* Create Task */}
                {user?.role === "ADMIN" && showNewTask && (
                    <div className="card mb-5 flex flex-col gap-3 border border-[var(--color-border)] p-4">
                        <h3 className="text-sm font-bold">
                            ایجاد وظیفه برای تأمین‌کننده
                        </h3>

                        <input
                            type="text"
                            maxLength={160}
                            placeholder="عنوان تسک"
                            value={newTask.title}
                            onChange={(event) =>
                                setNewTask((current) => ({
                                    ...current,
                                    title: event.target.value,
                                }))
                            }
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />

                        <textarea
                            maxLength={5000}
                            placeholder="توضیحات تسک (اختیاری)"
                            value={newTask.description}
                            onChange={(event) =>
                                setNewTask((current) => ({
                                    ...current,
                                    description: event.target.value,
                                }))
                            }
                            rows={3}
                            className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                        />

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--color-text-muted)]">
                                    اولویت
                                </label>

                                <Select
                                    options={priorityOptions}
                                    value={
                                        priorityOptions.find(
                                            (option) =>
                                                option.value === newTask.priority
                                        ) || priorityOptions[1]
                                    }
                                    onChange={(option) =>
                                        setNewTask((current) => ({
                                            ...current,
                                            priority:
                                                option?.value || "MEDIUM",
                                        }))
                                    }
                                    styles={selectStyles}
                                    isSearchable={false}
                                />
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs text-[var(--color-text-muted)]">
                                    تأمین‌کننده
                                </label>

                                <Select
                                    options={supplierOptions}
                                    value={
                                        supplierOptions.find(
                                            (option) =>
                                                option.value === newTask.toId
                                        ) || null
                                    }
                                    onChange={(option) =>
                                        setNewTask((current) => ({
                                            ...current,
                                            toId: option?.value || "",
                                        }))
                                    }
                                    placeholder="انتخاب تأمین‌کننده فعال"
                                    noOptionsMessage={() =>
                                        "تأمین‌کننده فعالی پیدا نشد"
                                    }
                                    styles={selectStyles}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-1.5 block text-xs text-[var(--color-text-muted)]">
                                مهلت انجام (اختیاری)
                            </label>

                            <input
                                type="datetime-local"
                                value={newTask.dueAt}
                                onChange={(event) =>
                                    setNewTask((current) => ({
                                        ...current,
                                        dueAt: event.target.value,
                                    }))
                                }
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                            />
                        </div>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setShowNewTask(false)}
                                disabled={submitting}
                                className="rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-4 py-2 text-sm text-[var(--color-text)] transition hover:bg-[var(--background-app)] disabled:opacity-50"
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
                                    : "ایجاد و ارسال تسک"}
                            </button>
                        </div>
                    </div>
                )}

                {/* Filters */}
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
                    ].map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => changeTaskFilter(item.id)}
                            className={`rounded-lg px-4 py-2 text-sm transition ${
                                filter === item.id
                                    ? "bg-[var(--color-primary)] text-white"
                                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                {/* Errors */}
                {tasksError && (
                    <div
                        role="alert"
                        className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500"
                    >
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
                        {tasks.map((task) => {
                            const taskStatus = getTaskStatus(task);

                            const status =
                                statusConfig[taskStatus] ||
                                statusConfig.TODO;

                            const priority =
                                priorityConfig[task.priority] ||
                                priorityConfig.MEDIUM;

                            const isOverdue =
                                currentTime > 0 &&
                                task.dueAt &&
                                new Date(task.dueAt).getTime() < currentTime &&
                                taskStatus !== "COMPLETED";

                            const isEditing =
                                editingTask?.id === task.id;

                            return (
                                <div
                                    key={task.id}
                                    className="card border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-accent)]"
                                >
                                    <div className="flex min-w-0 flex-col gap-3">
                                        {/* Task header */}
                                        <div className="flex min-w-0 items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`break-words text-sm font-semibold ${
                                                            taskStatus === "COMPLETED"
                                                                ? "text-[var(--color-text-muted)] line-through"
                                                                : "text-[var(--color-text)]"
                                                        }`}
                                                    >
                                                        {task.title}
                                                    </span>

                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-xs ${priority.color}`}
                                                    >
                                                        {priority.label}
                                                    </span>

                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-xs ${status.color}`}
                                                    >
                                                        {status.label}
                                                    </span>

                                                    {isOverdue && (
                                                        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                                                            گذشته از مهلت
                                                        </span>
                                                    )}
                                                </div>

                                                {task.description && (
                                                    <p className="mb-2 break-words text-xs leading-6 text-[var(--color-text-muted)] sm:text-sm">
                                                        {task.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        startEditingTask(task)
                                                    }
                                                    aria-label="ویرایش تسک"
                                                    className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                                                >
                                                    ویرایش
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        deleteTask(task.id)
                                                    }
                                                    disabled={deletingTaskId !== null}
                                                    aria-label="حذف تسک"
                                                    className="rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                                                >
                                                    {deletingTaskId === task.id
                                                        ? "..."
                                                        : "حذف"}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Task metadata */}
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)] sm:text-xs">
                                            <span>
                                                فرستنده:{" "}
                                                {task.from?.name || "—"}
                                            </span>

                                            <span>
                                                گیرنده:{" "}
                                                {task.to?.name || "—"}
                                            </span>

                                            <span>
                                                ایجاد:{" "}
                                                {formatDate(task.createdAt)}
                                            </span>

                                            <span
                                                className={
                                                    isOverdue
                                                        ? "font-semibold text-red-500"
                                                        : ""
                                                }
                                            >
                                                مهلت:{" "}
                                                {formatDate(task.dueAt, true)}
                                            </span>

                                            {task.completedAt && (
                                                <span className="text-green-600">
                                                    تکمیل:{" "}
                                                    {formatDate(
                                                        task.completedAt,
                                                        true
                                                    )}
                                                </span>
                                            )}
                                        </div>

                                        {/* Supplier response */}
                                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--background-app)] p-3">
                                            <div className="mb-1 text-xs font-semibold text-[var(--color-text)]">
                                                پاسخ تأمین‌کننده
                                            </div>

                                            {task.supplierResponse ? (
                                                <p className="whitespace-pre-wrap break-words text-xs leading-6 text-[var(--color-text-muted)]">
                                                    {task.supplierResponse}
                                                </p>
                                            ) : (
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    هنوز پاسخی ثبت نشده است.
                                                </p>
                                            )}
                                        </div>

                                        {/* Admin status control */}
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <label
                                                htmlFor={`task-status-${task.id}`}
                                                className="text-xs text-[var(--color-text-muted)]"
                                            >
                                                وضعیت وظیفه
                                            </label>

                                            <select
                                                id={`task-status-${task.id}`}
                                                value={taskStatus}
                                                disabled={savingTaskId === task.id}
                                                onChange={(event) =>
                                                    updateTaskStatus(
                                                        task,
                                                        event.target.value
                                                    )
                                                }
                                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:opacity-50 sm:w-52"
                                            >
                                                <option value="TODO">
                                                    در انتظار
                                                </option>
                                                <option value="IN_PROGRESS">
                                                    در حال انجام
                                                </option>
                                                <option value="COMPLETED">
                                                    تکمیل‌شده
                                                </option>
                                            </select>
                                        </div>

                                        {savingTaskId === task.id && (
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                در حال ذخیره تغییرات...
                                            </p>
                                        )}

                                        {/* Edit form */}
                                        {isEditing && (
                                            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--background-app)] p-3">
                                                <h4 className="text-sm font-bold">
                                                    ویرایش وظیفه
                                                </h4>

                                                <input
                                                    type="text"
                                                    maxLength={160}
                                                    value={editingTask.title}
                                                    onChange={(event) =>
                                                        setEditingTask((current) => ({
                                                            ...current,
                                                            title: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="عنوان تسک"
                                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                                />

                                                <textarea
                                                    maxLength={5000}
                                                    value={editingTask.description}
                                                    onChange={(event) =>
                                                        setEditingTask((current) => ({
                                                            ...current,
                                                            description: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="توضیحات"
                                                    rows={3}
                                                    className="w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                                />

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div>
                                                        <label className="mb-1.5 block text-xs text-[var(--color-text-muted)]">
                                                            اولویت
                                                        </label>

                                                        <Select
                                                            options={priorityOptions}
                                                            value={
                                                                priorityOptions.find(
                                                                    (option) =>
                                                                        option.value === editingTask.priority
                                                                ) || priorityOptions[1]
                                                            }
                                                            onChange={(option) =>
                                                                setEditingTask((current) => ({
                                                                    ...current,
                                                                    priority: option?.value || "MEDIUM",
                                                                }))
                                                            }
                                                            styles={selectStyles}
                                                            isSearchable={false}
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="mb-1.5 block text-xs text-[var(--color-text-muted)]">
                                                            مهلت انجام
                                                        </label>

                                                        <input
                                                            type="datetime-local"
                                                            value={editingTask.dueAt}
                                                            onChange={(event) =>
                                                                setEditingTask((current) => ({
                                                                    ...current,
                                                                    dueAt: event.target.value,
                                                                }))
                                                            }
                                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-card)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
                                                        />
                                                    </div>
                                                </div>

                                                <p className="text-[11px] text-[var(--color-text-muted)]">
                                                    برای حذف مهلت، مقدار تاریخ را خالی بگذار.
                                                </p>

                                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setEditingTask(null)
                                                        }
                                                        disabled={savingTaskId === task.id}
                                                        className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition hover:bg-[var(--background-card)] disabled:opacity-50"
                                                    >
                                                        انصراف
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={saveTask}
                                                        disabled={savingTaskId === task.id}
                                                        className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                                                    >
                                                        {savingTaskId === task.id
                                                            ? "در حال ذخیره..."
                                                            : "ذخیره تغییرات"}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {!tasksLoading && tasksPagination.totalPages > 1 && (
                    <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                        <div className="mb-3 text-center text-xs text-[var(--color-text-muted)]">
                            نمایش صفحه{" "}
                            {tasksPagination.page.toLocaleString("fa-IR")}
                            {" از "}
                            {tasksPagination.totalPages.toLocaleString("fa-IR")}
                            {" — مجموع "}
                            {tasksPagination.total.toLocaleString("fa-IR")}
                            {" تسک"}
                        </div>

                        <Pagination
                            currentPage={tasksPagination.page}
                            totalPages={tasksPagination.totalPages}
                            onPageChange={changeTasksPage}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
