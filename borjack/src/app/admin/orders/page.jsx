"use client";
import { useEffect, useState } from "react";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUSES } from "../../../lib/orderStatus";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const load = () => {
    fetch("/api/admin/orders")
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (orderId, status) => {
    setUpdating(orderId);
    await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, status } : o)
    );
    setUpdating(null);
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">سفارشات</h1>

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
                <>
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">#{order.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{order.user?.name}</td>
                    <td className="px-4 py-3">{order.total.toLocaleString("fa-IR")} تومان</td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus(order.id, e.target.value)}
                        disabled={updating === order.id}
                        className={`text-xs px-2 py-1 rounded-lg border-0 font-medium cursor-pointer focus:outline-none ${ORDER_STATUS_COLORS[order.status]}`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                        className="text-blue-600 hover:text-blue-800 text-xs transition"
                      >
                        {expanded === order.id ? "بستن" : "مشاهده"}
                      </button>
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr key={`${order.id}-items`}>
                      <td colSpan={6} className="px-4 pb-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                          {order.items?.map((item) => (
                            <div key={item.id} className="flex justify-between">
                              <span>{item.product?.title} × {item.quantity}</span>
                              <span>{(item.price * item.quantity).toLocaleString("fa-IR")} تومان</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}