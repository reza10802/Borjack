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
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead
          className="text-right"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-muted)",
          }}
        >
          <tr>
            <th className="px-5 py-4 font-medium whitespace-nowrap">شماره</th>
            <th className="px-5 py-4 font-medium whitespace-nowrap">مشتری</th>
            <th className="px-5 py-4 font-medium whitespace-nowrap">مبلغ</th>
            <th className="px-5 py-4 font-medium whitespace-nowrap">وضعیت</th>
            <th className="px-5 py-4 font-medium whitespace-nowrap">تاریخ</th>
            <th className="px-5 py-4 font-medium whitespace-nowrap">جزئیات</th>
          </tr>
        </thead>

        {loading ? (
          <OrdersTableSkeleton />
        ) : orders.length === 0 ? (
          <tbody>
            <tr>
              <td
                colSpan={6}
                className="py-12 text-center muted"
              >
                سفارشی ثبت نشده
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody
            className="divide-y"
            style={{
              borderColor: "var(--color-border)",
            }}
          >
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