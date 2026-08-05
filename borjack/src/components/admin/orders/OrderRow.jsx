"use client";

import { memo } from "react";
import {
    ORDER_STATUS_LABELS,
    ORDER_STATUS_COLORS,
    ORDER_STATUSES,
} from "@/lib/orderStatus";

function OrderRow({
    order,
    expanded,
    setExpanded,
    updating,
    setConfirmOpen,
    setSelectedOrder,
    setNextStatus
}) {
    return (
        <>
            <tr
                className="transition-colors"
                style={{
                    color: "var(--color-text)",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-surface-2)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                }}
            >
                <td className="px-5 py-4 muted">
                    #{order.id}
                </td>

                <td className="px-5 py-4 font-medium text-[var(--color-text)]">
                    {order.user?.name || "—"}
                </td>

                <td className="px-4 py-3">
                    {Number(order.total || 0).toLocaleString("fa-IR")} تومان
                </td>

                <td className="px-5 py-4">
                    {order.paymentStatus === "PENDING" ? (
                        <span className="px-3 py-1 rounded-xl text-xs font-medium bg-yellow-100 text-yellow-700">
                            در انتظار پرداخت
                        </span>
                    ) : (
                        <select
                            value={order.status}
                            onChange={(e) => {
                                setSelectedOrder(order.id);
                                setNextStatus(e.target.value);
                                setConfirmOpen(true);
                            }}
                            disabled={updating === order.id}
                            className={`rounded-xl px-3 py-2 text-xs font-medium border border-[var(--color-border)] cursor-pointer transition ${ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}
                        >
                            {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {ORDER_STATUS_LABELS[status]}
                                </option>
                            ))}
                        </select>
                    )}
                </td>

                <td className="px-5 py-4 muted">
                    {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </td>

                <td className="px-4 py-3">
                    <button
                        onClick={() =>
                            setExpanded(
                                expanded === order.id ? null : order.id
                            )
                        }
                        className="btn-outline text-xs px-3 py-2"
                    >
                        {expanded === order.id ? "بستن" : "مشاهده"}
                    </button>
                </td>
            </tr>

            {expanded === order.id && (
                <tr>
                    <td colSpan={6} className="px-5 pb-5">
                        <div
                            className="rounded-2xl p-4 text-sm space-y-2 border"
                            style={{
                                background: "var(--color-surface-2)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-text)",
                            }}
                        >
                            {order.items?.length ? (
                                order.items.map((item) => (
                                    <div
                                        key={item.id ?? `${order.id}-${item.productId}`}
                                        className="flex justify-between"
                                    >
                                        <span>
                                            {item.product?.title || "محصول"} ×{" "}
                                            {item.quantity}
                                        </span>

                                        <span>
                                            {Number(
                                                (item.price || 0) *
                                                (item.quantity || 0)
                                            ).toLocaleString("fa-IR")}{" "}
                                            تومان
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="muted">
                                    آیتمی برای این سفارش ثبت نشده
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export default memo(OrderRow);