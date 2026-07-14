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
            <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                    #{order.id}
                </td>

                <td className="px-4 py-3 font-medium text-gray-800">
                    {order.user?.name || "—"}
                </td>

                <td className="px-4 py-3">
                    {Number(order.total || 0).toLocaleString("fa-IR")} تومان
                </td>

                <td className="px-4 py-3">
                    {order.paymentStatus === "PENDING" ? (
                        <span className="text-xs px-2 py-1 rounded-lg bg-yellow-100 text-yellow-700">
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
                            className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer ${ORDER_STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                                }`}
                        >
                            {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                    {ORDER_STATUS_LABELS[status]}
                                </option>
                            ))}
                        </select>
                    )}
                </td>

                <td className="px-4 py-3 text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </td>

                <td className="px-4 py-3">
                    <button
                        onClick={() =>
                            setExpanded(
                                expanded === order.id ? null : order.id
                            )
                        }
                        className="text-blue-600 hover:text-blue-800 text-xs transition"
                    >
                        {expanded === order.id ? "بستن" : "مشاهده"}
                    </button>
                </td>
            </tr>

            {expanded === order.id && (
                <tr>
                    <td colSpan={6} className="px-4 pb-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
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
                                <div className="text-gray-400">
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