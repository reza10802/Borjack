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
    <div className="card mb-6 flex flex-wrap gap-3 p-4">
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setExpanded(null);
        }}
        placeholder="نام یا شماره مشتری..."
        className=" h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none transition "
      />

      <select
        value={statusFilter}
        onChange={(e) => {
          setStatusFilter(e.target.value);
          setExpanded(null);
          setPage(1);
        }}
        className=" h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none transition "
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
        className=" h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none transition "
      >
        <option value="">همه پرداخت‌ها</option>

        <option value="PAID">پرداخت شده</option>
        <option value="PENDING">در انتظار پرداخت</option>
      </select>
    </div>
  );
}