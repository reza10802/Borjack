
"use client";

import { useEffect, useState } from "react";
import Pagination from "@/components/pagination";

const FILTERS = [
    { value: "all", label: "همه مرسوله‌ها" },
    { value: "PREPARING", label: "در حال آماده‌سازی" },
    { value: "READY_FOR_HANDOVER", label: "آماده تحویل" },
    { value: "HANDED_TO_CARRIER", label: "تحویل به شرکت حمل" },
    { value: "SHIPPED", label: "ارسال‌شده" },
    { value: "DELIVERED", label: "تحویل‌شده" },
    { value: "ISSUE", label: "دارای مشکل" },
];

const STATUS_META = {
    PREPARING: {
        label: "در حال آماده‌سازی",
        className: "bg-blue-500/10 text-blue-600",
    },
    READY_FOR_HANDOVER: {
        label: "آماده تحویل",
        className: "bg-amber-500/10 text-amber-600",
    },
    HANDED_TO_CARRIER: {
        label: "تحویل به شرکت حمل",
        className: "bg-violet-500/10 text-violet-600",
    },
    SHIPPED: {
        label: "ارسال‌شده",
        className: "bg-emerald-500/10 text-emerald-600",
    },
    DELIVERED: {
        label: "تحویل‌شده",
        className: "bg-green-500/10 text-green-600",
    },
    ISSUE: {
        label: "نیازمند بررسی",
        className: "bg-red-500/10 text-red-600",
    },
};

const NEXT_ACTION = {
    PREPARING: {
        status: "READY_FOR_HANDOVER",
        label: "اتمام آماده‌سازی",
    },
    READY_FOR_HANDOVER: {
        status: "HANDED_TO_CARRIER",
        label: "تحویل به شرکت حمل",
    },
    HANDED_TO_CARRIER: {
        status: "SHIPPED",
        label: "ثبت کد رهگیری و ارسال",
    },
};

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("fa-IR");
}

function StatusBadge({ status }) {
    const meta = STATUS_META[status];

    return (
        <span
            className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${
                meta?.className || "bg-zinc-500/10 text-zinc-500"
            }`}
        >
            {meta?.label || status || "نامشخص"}
        </span>
    );
}

export default function SupplierOrdersPage() {
    const [fulfillments, setFulfillments] = useState([]);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [reloadKey, setReloadKey] = useState(0);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [activeAction, setActiveAction] = useState(null);
    const [trackingCode, setTrackingCode] = useState("");
    const [issueNote, setIssueNote] = useState("");
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        let cancelled = false;

        const params = new URLSearchParams({
            page: String(page),
            limit: "20",
        });

        if (statusFilter !== "all") {
            params.set("status", statusFilter);
        }

        fetch(`/api/supplier/orders?${params.toString()}`, {
            cache: "no-store",
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(
                        data.error || "خطا در دریافت سفارش‌ها"
                    );
                }

                return data;
            })
            .then((data) => {
                if (cancelled) return;

                setFulfillments(
                    Array.isArray(data.fulfillments)
                        ? data.fulfillments
                        : []
                );

                setPagination(
                    data.pagination || {
                        page: 1,
                        totalPages: 1,
                        total: 0,
                    }
                );

                setError("");
            })
            .catch((err) => {
                if (cancelled) return;

                setError(
                    err.message || "خطا در ارتباط با سرور"
                );
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [statusFilter, page, reloadKey]);

    const handleFilterChange = (value) => {
        if (value === statusFilter && page === 1) return;

        setStatusFilter(value);
        setPage(1);
        setError("");
        setNotice("");
        setActiveAction(null);
    };

    const handlePageChange = (nextPage) => {
        setPage(nextPage);
        setError("");
        setNotice("");
        setActiveAction(null);
    };

    const openAction = (fulfillment, type) => {
        const nextAction = NEXT_ACTION[fulfillment.status];

        setActiveAction({
            id: fulfillment.id,
            type,
            nextStatus:
                type === "transition"
                    ? nextAction?.status
                    : "ISSUE",
        });

        setTrackingCode("");
        setIssueNote("");
        setError("");
        setNotice("");
    };

    const closeAction = () => {
        setActiveAction(null);
        setTrackingCode("");
        setIssueNote("");
    };

    const handleSubmitAction = async (event) => {
        event.preventDefault();

        if (!activeAction) return;

        const { id, type, nextStatus } = activeAction;

        if (
            type === "transition" &&
            nextStatus === "SHIPPED" &&
            !trackingCode.trim()
        ) {
            setError("وارد کردن کد رهگیری الزامی است.");
            return;
        }

        if (type === "issue" && !issueNote.trim()) {
            setError("توضیح مشکل الزامی است.");
            return;
        }

        const payload =
            type === "issue"
                ? {
                    status: "ISSUE",
                    issueNote: issueNote.trim(),
                }
                : {
                    status: nextStatus,
                    ...(nextStatus === "SHIPPED"
                        ? {
                            trackingCode: trackingCode.trim(),
                        }
                        : {}),
                };

        try {
            setSavingId(id);
            setError("");
            setNotice("");

            const res = await fetch(
                `/api/supplier/orders/${id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setError(
                    data.error || "به‌روزرسانی مرسوله انجام نشد."
                );
                return;
            }

            closeAction();

            setNotice(
                type === "issue"
                    ? "گزارش مشکل با موفقیت ثبت شد."
                    : "وضعیت مرسوله با موفقیت به‌روزرسانی شد."
            );

            setReloadKey((current) => current + 1);
        } catch {
            setError("خطا در ارتباط با سرور.");
        } finally {
            setSavingId(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold">
                        سفارش‌های من
                    </h1>

                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        مدیریت آماده‌سازی و ارسال مرسوله‌های شما
                    </p>
                </div>

                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm">
                    مجموع مرسوله‌ها:
                    <strong className="mr-2">
                        {formatNumber(pagination.total)}
                    </strong>
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
                {FILTERS.map((filter) => {
                    const active = statusFilter === filter.value;

                    return (
                        <button
                            key={filter.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                                handleFilterChange(filter.value)
                            }
                            className={`inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium leading-5 transition-colors duration-150 ${
                                active
                                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                            }`}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </p>
            )}

            {notice && (
                <p
                    role="status"
                    className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700"
                >
                    {notice}
                </p>
            )}

            {loading ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-text-muted)]">
                    در حال دریافت سفارش‌ها…
                </div>
            ) : fulfillments.length === 0 ? (
                <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-sm text-[var(--color-text-muted)]">
                    مرسوله‌ای برای نمایش وجود ندارد.
                </div>
            ) : (
                <div className="space-y-4">
                    {fulfillments.map((fulfillment) => {
                        const order = fulfillment.order;
                        const action = NEXT_ACTION[fulfillment.status];

                        const isActionOpen =
                            activeAction?.id === fulfillment.id;

                        const isSaving =
                            savingId === fulfillment.id;

                        return (
                            <section
                                key={fulfillment.id}
                                className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
                                    <div>
                                        <p className="font-bold">
                                            سفارش #{formatNumber(order?.id)}
                                        </p>

                                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                            ثبت سفارش:{" "}
                                            {formatDate(order?.createdAt)}
                                        </p>
                                    </div>

                                    <StatusBadge
                                        status={fulfillment.status}
                                    />
                                </div>

                                <div className="grid gap-5 p-4 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h2 className="text-sm font-bold">
                                            کالاهای این مرسوله
                                        </h2>

                                        <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                                            {fulfillment.items?.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between gap-3 p-3"
                                                >
                                                    <span className="min-w-0 text-sm font-medium">
                                                        {item.orderItem?.product?.title ||
                                                            "کالای سفارش"}
                                                    </span>

                                                    <span className="shrink-0 rounded-lg bg-[var(--background-app)] px-2.5 py-1 text-xs">
                                                        تعداد:{" "}
                                                        {formatNumber(item.quantity)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {fulfillment.shippingMethod && (
                                            <p className="text-xs text-[var(--color-text-muted)]">
                                                روش ارسال:{" "}
                                                {fulfillment.shippingMethod}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <h2 className="text-sm font-bold">
                                            اطلاعات گیرنده
                                        </h2>

                                        <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-3 text-sm">
                                            <p>
                                                <span className="text-[var(--color-text-muted)]">
                                                    نام گیرنده:{" "}
                                                </span>
                                                {order?.receiverName || "—"}
                                            </p>

                                            <p>
                                                <span className="text-[var(--color-text-muted)]">
                                                    تلفن:{" "}
                                                </span>
                                                {order?.receiverPhone || "—"}
                                            </p>

                                            <p>
                                                <span className="text-[var(--color-text-muted)]">
                                                    استان و شهر:{" "}
                                                </span>
                                                {[
                                                    order?.provinceName,
                                                    order?.cityName,
                                                ]
                                                    .filter(Boolean)
                                                    .join("، ") || "—"}
                                            </p>

                                            <p className="leading-7">
                                                <span className="text-[var(--color-text-muted)]">
                                                    آدرس:{" "}
                                                </span>
                                                {order?.address || "—"}
                                            </p>

                                            <p>
                                                <span className="text-[var(--color-text-muted)]">
                                                    کد پستی:{" "}
                                                </span>
                                                {order?.postalCode || "—"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {(fulfillment.trackingCode ||
                                    fulfillment.issueNote) && (
                                    <div className="mx-4 mb-4 space-y-2 rounded-xl bg-[var(--background-app)] p-3 text-sm">
                                        {fulfillment.trackingCode && (
                                            <p>
                                                <span className="text-[var(--color-text-muted)]">
                                                    کد رهگیری:{" "}
                                                </span>

                                                <b
                                                    dir="ltr"
                                                    className="inline-block"
                                                >
                                                    {fulfillment.trackingCode}
                                                </b>
                                            </p>
                                        )}

                                        {fulfillment.issueNote && (
                                            <p className="leading-7 text-red-600">
                                                <span className="font-medium">
                                                    توضیح مشکل:{" "}
                                                </span>

                                                {fulfillment.issueNote}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-3 border-t border-[var(--color-border)] p-4">
                                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--color-text-muted)]">
                                        {fulfillment.handedOverAt && (
                                            <span>
                                                تحویل به شرکت حمل:{" "}
                                                {formatDate(
                                                    fulfillment.handedOverAt
                                                )}
                                            </span>
                                        )}

                                        {fulfillment.shippedAt && (
                                            <span>
                                                تاریخ ارسال:{" "}
                                                {formatDate(
                                                    fulfillment.shippedAt
                                                )}
                                            </span>
                                        )}

                                        {fulfillment.deliveredAt && (
                                            <span>
                                                تاریخ تحویل:{" "}
                                                {formatDate(
                                                    fulfillment.deliveredAt
                                                )}
                                            </span>
                                        )}
                                    </div>

                                    {/* فاکتور اختصاصی همین مرسوله */}
                                    {order?.requiresPrintedInvoice &&
                                        fulfillment.status !== "ISSUE" && (
                                            <a
                                                href={`/fulfillments/${encodeURIComponent(
                                                    fulfillment.id
                                                )}/invoice`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-surface-2)]"
                                            >
                                                <span aria-hidden="true">
                                                    ▤
                                                </span>

                                                مشاهده و چاپ فاکتور این مرسوله
                                            </a>
                                        )}

                                    {action &&
                                        fulfillment.status !== "ISSUE" && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() =>
                                                        openAction(
                                                            fulfillment,
                                                            "transition"
                                                        )
                                                    }
                                                    className="btn-primary rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
                                                >
                                                    {action.label}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={() =>
                                                        openAction(
                                                            fulfillment,
                                                            "issue"
                                                        )
                                                    }
                                                    className="rounded-xl border border-red-300 px-4 py-2.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                                >
                                                    گزارش مشکل
                                                </button>
                                            </div>
                                        )}

                                    {fulfillment.status === "ISSUE" && (
                                        <p className="text-sm text-red-600">
                                            این مرسوله متوقف شده و ادامه فرایند باید توسط مدیریت انجام شود.
                                        </p>
                                    )}

                                    {fulfillment.status === "SHIPPED" && (
                                        <p className="text-sm text-emerald-600">
                                            مرسوله ارسال شده و منتظر ثبت تحویل نهایی است.
                                        </p>
                                    )}

                                    {fulfillment.status === "DELIVERED" && (
                                        <p className="text-sm text-emerald-600">
                                            این مرسوله تحویل مشتری شده است.
                                        </p>
                                    )}

                                    {isActionOpen && (
                                        <form
                                            onSubmit={handleSubmitAction}
                                            className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--background-app)] p-4"
                                        >
                                            {activeAction.type === "issue" ? (
                                                <>
                                                    <label className="block text-sm font-medium">
                                                        توضیح مشکل
                                                    </label>

                                                    <textarea
                                                        value={issueNote}
                                                        onChange={(event) =>
                                                            setIssueNote(
                                                                event.target.value
                                                            )
                                                        }
                                                        maxLength={1000}
                                                        rows={3}
                                                        required
                                                        placeholder="مشکل این مرسوله را شرح دهید..."
                                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm outline-none focus:border-[var(--color-primary)]"
                                                    />

                                                    <p className="text-xs text-[var(--color-text-muted)]">
                                                        ثبت گزارش باعث توقف ادامه مراحل این مرسوله تا بررسی مدیریت می‌شود.
                                                    </p>
                                                </>
                                            ) : activeAction.nextStatus === "SHIPPED" ? (
                                                <>
                                                    <label className="block text-sm font-medium">
                                                        کد رهگیری پستی
                                                    </label>

                                                    <input
                                                        type="text"
                                                        value={trackingCode}
                                                        onChange={(event) =>
                                                            setTrackingCode(
                                                                event.target.value
                                                            )
                                                        }
                                                        maxLength={100}
                                                        required
                                                        dir="ltr"
                                                        placeholder="کد رهگیری را وارد کنید"
                                                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left text-sm outline-none focus:border-[var(--color-primary)]"
                                                    />

                                                    <p className="text-xs text-[var(--color-text-muted)]">
                                                        پس از ثبت، کد رهگیری برای مشتری قابل مشاهده خواهد بود.
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-sm">
                                                    آیا از ثبت این مرحله برای مرسوله مطمئن هستید؟
                                                </p>
                                            )}

                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="submit"
                                                    disabled={isSaving}
                                                    className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
                                                >
                                                    {isSaving
                                                        ? "در حال ثبت..."
                                                        : "تأیید و ثبت"}
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isSaving}
                                                    onClick={closeAction}
                                                    className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm hover:bg-[var(--color-surface)] disabled:opacity-50"
                                                >
                                                    انصراف
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {!loading && pagination.totalPages > 1 && (
                <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    onPageChange={handlePageChange}
                />
            )}
        </div>
    );
}
