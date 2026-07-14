import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from "@/lib/orderStatus";

export default function OrdersFilters({
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  paymentFilter,
  setPaymentFilter,
  setExpanded,
  setPage,
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-5">
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setExpanded(null);
        }}
        placeholder="نام یا شماره مشتری..."
        className="border rounded-lg px-3 py-2"
      />

      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setExpanded(null);
          setPage(1);
        }}
        className="border rounded-lg px-3 py-2"
      >
        <option value="">همه وضعیت‌ها</option>

        {ORDER_STATUSES.map((status) => (
          <option key={status} value={status}>
            {ORDER_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <select
        value={paymentFilter}
        onChange={(e) => {
          setPaymentFilter(e.target.value);
          setExpanded(null);
          setPage(1);
        }}
        className="border rounded-lg px-3 py-2"
      >
        <option value="">همه پرداخت‌ها</option>

        <option value="PAID">پرداخت شده</option>
        <option value="PENDING">در انتظار پرداخت</option>
      </select>
    </div>
  );
}