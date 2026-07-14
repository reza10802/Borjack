import OrderRow from "./OrderRow";
import OrdersTableSkeleton from "./OrdersTableSkeleton";

export default function OrdersTable({
  loading,
  orders,
  expanded,
  setExpanded,
  updating,
  setConfirmOpen,
  setSelectedOrder,
  setNextStatus
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
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

        {loading ? (
          <OrdersTableSkeleton />
        ) : orders.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={6} className="py-10 text-center text-gray-400">
                سفارشی ثبت نشده
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                expanded={expanded}
                setExpanded={setExpanded}
                updating={updating}
                
                setConfirmOpen={setConfirmOpen}
                setSelectedOrder={setSelectedOrder}
                setNextStatus={setNextStatus}
              />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}