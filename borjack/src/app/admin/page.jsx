"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

const priorityConfig = {
    HIGH:   { label: "بالا",   color: "bg-red-100 text-red-700" },
    MEDIUM: { label: "متوسط", color: "bg-yellow-100 text-yellow-700" },
    LOW:    { label: "کم",    color: "bg-green-100 text-green-700" },
};

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [tasks, setTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [filter, setFilter] = useState("received");
    const [users, setUsers] = useState([]);
    const [showNewTask, setShowNewTask] = useState(false);
    const [newTask, setNewTask] = useState({ title: "", description: "", priority: "MEDIUM", toId: "" });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch("/api/admin/stats")
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setStats(d); })
            .catch(() => {})
            .finally(() => setStatsLoading(false));

        fetch("/api/admin/users")
            .then(r => r.ok ? r.json() : { users: [] })
            .then(d => setUsers((d.users || []).filter(u => u.role !== "CUSTOMER")))
            .catch(() => setUsers([]));
    }, []);

    useEffect(() => {
        setTasksLoading(true);
        fetch(`/api/admin/tasks?filter=${filter}`)
            .then(r => r.ok ? r.json() : { tasks: [] })
            .then(d => setTasks(d.tasks || []))
            .catch(() => setTasks([]))
            .finally(() => setTasksLoading(false));
    }, [filter]);

    const toggleDone = async (task) => {
        const res = await fetch(`/api/admin/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ done: !task.done }),
        });
        if (res.ok) {
            const { task: updated } = await res.json();
            setTasks(tasks.map(t => t.id === updated.id ? updated : t));
        }
    };

    const deleteTask = async (id) => {
        const res = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
        if (res.ok) setTasks(tasks.filter(t => t.id !== id));
    };

    const createTask = async () => {
        if (!newTask.title || !newTask.toId) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/admin/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newTask),
            });
            if (res.ok) {
                const { task } = await res.json();
                setTasks([task, ...tasks]);
                setNewTask({ title: "", description: "", priority: "MEDIUM", toId: "" });
                setShowNewTask(false);
            }
        } catch {}
        setSubmitting(false);
    };

    const statCards = stats ? [
        { label: "کل کالاها", value: stats.products, icon: "📦" },
        { label: "سفارشات امروز", value: stats.todayOrders, icon: "🛒" },
        { label: "کاربران", value: stats.users, icon: "👥" },
        { label: "ناموجود", value: stats.outOfStock, icon: "⚠️" },
    ] : [];

    return (
        <div dir="rtl">
            <h1 className="text-xl font-bold text-gray-800 mb-6">خوش آمدید، {user?.name} 👋</h1>

            {/* آمار */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {statsLoading
                    ? [...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl p-5 animate-pulse h-24" />)
                    : statCards.map(card => (
                        <div key={card.label} className="bg-white rounded-xl p-5 border border-gray-100">
                            <div className="text-2xl mb-2">{card.icon}</div>
                            <div className="text-2xl font-bold text-gray-800">{card.value}</div>
                            <div className="text-sm text-gray-500 mt-1">{card.label}</div>
                        </div>
                    ))
                }
            </div>

            {/* سیستم تسک */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-800">تسک‌ها</h2>
                    <button onClick={() => setShowNewTask(s => !s)}
                        className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition">
                        + تسک جدید
                    </button>
                </div>

                {showNewTask && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-5 flex flex-col gap-3">
                        <input type="text" placeholder="عنوان تسک" value={newTask.title}
                            onChange={e => setNewTask(t => ({ ...t, title: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400" />
                        <textarea placeholder="توضیحات (اختیاری)" value={newTask.description}
                            onChange={e => setNewTask(t => ({ ...t, description: e.target.value }))}
                            rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none" />
                        <div className="flex gap-3">
                            <select value={newTask.priority}
                                onChange={e => setNewTask(t => ({ ...t, priority: e.target.value }))}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                                <option value="HIGH">اولویت بالا</option>
                                <option value="MEDIUM">اولویت متوسط</option>
                                <option value="LOW">اولویت کم</option>
                            </select>
                            <select value={newTask.toId}
                                onChange={e => setNewTask(t => ({ ...t, toId: e.target.value }))}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white">
                                <option value="">انتخاب گیرنده</option>
                                {users.filter(u => u.id !== user?.id).map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowNewTask(false)}
                                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-100 transition">
                                انصراف
                            </button>
                            <button onClick={createTask} disabled={submitting}
                                className="px-4 py-2 text-sm bg-black text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50">
                                {submitting ? "در حال ارسال..." : "ارسال"}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex gap-2 mb-4">
                    {[{ id: "received", label: "دریافتی" }, { id: "sent", label: "ارسالی" }, { id: "all", label: "همه" }].map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)}
                            className={`px-4 py-1.5 rounded-lg text-sm transition ${filter === f.id ? "bg-black text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {tasksLoading ? (
                    <div className="text-center py-8 text-gray-400 text-sm">در حال بارگذاری...</div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">تسکی وجود ندارد</div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {tasks.map(task => (
                            <div key={task.id}
                                className={`flex items-start gap-3 p-4 rounded-xl border transition ${task.done ? "bg-gray-50 border-gray-100 opacity-60" : "bg-white border-gray-200"}`}>
                                <button onClick={() => toggleDone(task)}
                                    className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition ${task.done ? "bg-black border-black" : "border-gray-300 hover:border-black"}`}>
                                    {task.done && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>}
                                </button>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className={`text-sm font-medium ${task.done ? "line-through text-gray-400" : "text-gray-800"}`}>
                                            {task.title}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig[task.priority]?.color}`}>
                                            {priorityConfig[task.priority]?.label}
                                        </span>
                                    </div>
                                    {task.description && <p className="text-xs text-gray-500 mb-1">{task.description}</p>}
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>از: {task.from?.name}</span>
                                        <span>←</span>
                                        <span>به: {task.to?.name}</span>
                                        <span>·</span>
                                        <span>{new Date(task.createdAt).toLocaleDateString("fa-IR")}</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteTask(task.id)}
                                    className="text-gray-300 hover:text-red-500 transition text-lg shrink-0">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}