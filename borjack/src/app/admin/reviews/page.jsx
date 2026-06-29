"use client";
// src/app/admin/reviews/page.jsx
import { useEffect, useState } from "react";

const STARS = (rating) => [1,2,3,4,5].map(i => (
    <span key={i} className={i <= rating ? "text-yellow-400" : "text-gray-200"}>★</span>
));

export default function AdminReviews() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("pending");
    const [updating, setUpdating] = useState(null);

    const load = () => {
        setLoading(true);
        fetch(`/api/admin/reviews?filter=${filter}`)
            .then(r => r.json())
            .then(d => setReviews(d.reviews || []))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filter]);

    const handleApprove = async (id, approved) => {
        setUpdating(id);
        await fetch("/api/admin/reviews", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewId: id, approved }),
        });
        setUpdating(null);
        load();
    };

    const handleDelete = async (id) => {
        if (!confirm("حذف این نظر؟")) return;
        await fetch(`/api/admin/reviews?id=${id}`, { method: "DELETE" });
        load();
    };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">نظرات</h1>
                <p className="text-sm text-gray-500 mt-0.5">{reviews.length} نظر</p>
            </div>

            <div className="flex gap-2 mb-4">
                {[
                    { key: "pending", label: "در انتظار تایید" },
                    { key: "approved", label: "تایید شده" },
                    { key: "all", label: "همه" },
                ].map(t => (
                    <button key={t.key} onClick={() => setFilter(t.key)}
                        className={`px-4 py-1.5 text-sm rounded-xl transition ${filter === t.key ? "bg-black text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />)}</div>
            ) : reviews.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">نظری یافت نشد</p>
            ) : (
                <div className="space-y-3">
                    {reviews.map(r => (
                        <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium text-sm text-gray-900">{r.user}</span>
                                        <div className="flex text-sm">{STARS(r.rating)}</div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.approved ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                                            {r.approved ? "تایید شده" : "در انتظار"}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">{r.comment}</p>
                                    <p className="text-xs text-gray-400">{r.product?.title} — {r.date}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {!r.approved && (
                                        <button onClick={() => handleApprove(r.id, true)} disabled={updating === r.id}
                                            className="text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition disabled:opacity-50">
                                            تایید
                                        </button>
                                    )}
                                    {r.approved && (
                                        <button onClick={() => handleApprove(r.id, false)} disabled={updating === r.id}
                                            className="text-xs px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition disabled:opacity-50">
                                            رد تایید
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(r.id)}
                                        className="text-xs px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50 transition">
                                        حذف
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}