"use client";

import { useEffect, useState } from "react";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUSES,
} from "@/lib/orderStatus";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/orders");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در دریافت سفارشات");
        setOrders([]);
        return;
      }

      setOrders(data.orders || []);
    } catch {
      setError("خطا در ارتباط با سرور");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    setError("");

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "خطا در تغییر وضعیت سفارش");
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? data.order : o))
      );
    } catch {
      setError("خطا در ارتباط با سرور");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">سفارشات</h1>

      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">در حال بارگذاری...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-gray-400">سفارشی ثبت نشده</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-right">
              <tr>
                <th className="px-4 py-3 font-medium">شماره</th>
                <th className="px-4 py-3 font-medium">مشتری</th>
                <th className="px-4 py-3 font-medium">مبلغ</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">تاریخ</th>
                <th className="px-4 py-3 font-medium">جزئیات</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => (
                <FragmentRow
                  key={order.id}
                  order={order}
                  expanded={expanded}
                  setExpanded={setExpanded}
                  updating={updating}
                  updateStatus={updateStatus}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FragmentRow({
  order,
  expanded,
  setExpanded,
  updating,
  updateStatus,
}) {
  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3 text-gray-500">#{order.id}</td>

        <td className="px-4 py-3 font-medium text-gray-800">
          {order.user?.name || "—"}
        </td>

        <td className="px-4 py-3">
          {Number(order.total || 0).toLocaleString("fa-IR")} تومان
        </td>

        <td className="px-4 py-3">
          <select
            value={order.status}
            onChange={(e) => updateStatus(order.id, e.target.value)}
            disabled={updating === order.id}
            className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer focus:outline-none ${
              ORDER_STATUS_COLORS[order.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>

        <td className="px-4 py-3 text-gray-500">
          {new Date(order.createdAt).toLocaleDateString("fa-IR")}
        </td>

        <td className="px-4 py-3">
          <button
            onClick={() =>
              setExpanded(expanded === order.id ? null : order.id)
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
                      {item.product?.title || "محصول"} × {item.quantity}
                    </span>
                    <span>
                      {Number((item.price || 0) * (item.quantity || 0)).toLocaleString("fa-IR")} تومان
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-400">آیتمی برای این سفارش ثبت نشده</div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}