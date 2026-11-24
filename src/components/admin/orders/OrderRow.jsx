
import { memo } from "react";
import {
    ORDER_STATUS_LABELS,
    ORDER_STATUS_COLORS,
    ORDER_STATUSES,
} from "@/lib/orderStatus";

function formatToman(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "—";
    }

    return `${amount.toLocaleString("fa-IR")} تومان`;
}

function formatPercent(value) {
    const percent = Number(value);

    if (!Number.isFinite(percent)) {
        return "—";
    }

    return `${percent.toLocaleString("fa-IR")}%`;
}

function getQuantity(item) {
    const quantity = Number(item.quantity);

    return Number.isSafeInteger(quantity) && quantity > 0
        ? quantity
        : 0;
}

// Shared theme-aware style for interactive actions.
const THEME_BUTTON_CLASS =
    "inline-flex items-center justify-center gap-2 rounded-xl " +
    "border border-[var(--color-border)] " +
    "bg-[var(--color-surface)] " +
    "px-3.5 py-2 text-xs font-medium " +
    "text-[var(--color-text)] " +
    "transition-colors " +
    "hover:border-[var(--color-primary)] " +
    "hover:bg-[var(--color-surface-2)] " +
    "hover:text-[var(--color-primary)] " +
    "focus-visible:outline-none " +
    "focus-visible:ring-2 " +
    "focus-visible:ring-[var(--color-primary)] " +
    "focus-visible:ring-offset-2";

function hasCompleteSupplierSnapshot(item) {
    return (
        item.basePriceAtPurchase != null &&
        item.commissionPercentAtPurchase != null &&
        item.supplierDiscountPercentAtPurchase != null &&
        item.supplierDiscountAmountAtPurchase != null &&
        item.supplierPayoutAtPurchase != null &&
        item.commissionAmountAtPurchase != null
    );
}

const FULFILLMENT_STATUS_LABELS = {
    PREPARING: "در حال آماده‌سازی",
    READY_FOR_HANDOVER: "آماده تحویل",
    HANDED_TO_CARRIER: "تحویل به شرکت حمل",
    SHIPPED: "ارسال‌شده",
    DELIVERED: "تحویل‌شده",
    ISSUE: "دارای مشکل",
};

function FinancialValue({ label, value }) {
    return (
        <div className="rounded-xl border border-[var(--color-border)] p-3">
            <div className="text-xs muted mb-1">
                {label}
            </div>

            <div className="font-medium">
                {value}
            </div>
        </div>
    );
}

function SupplierFinancialDetails({ item, quantity }) {
    if (!item.supplierId) {
        return (
            <div className="mt-3 rounded-xl border border-[var(--color-border)] p-3 text-xs muted">
                این کالا متعلق به برجک است و تسویه تأمین‌کننده ندارد.
            </div>
        );
    }

    if (!hasCompleteSupplierSnapshot(item)) {
        return (
            <div className="mt-3 rounded-xl border border-[var(--color-border)] p-3 text-xs">
                <div className="font-medium mb-1">
                    اطلاعات مالی تأمین‌کننده
                </div>

                <div className="muted">
                    Snapshot مالی کامل برای این کالا در زمان خرید ثبت نشده است.
                    مبلغ تسویه و کمیسیون از قیمت فعلی محصول محاسبه نمی‌شود.
                </div>
            </div>
        );
    }

    const basePrice = Number(item.basePriceAtPurchase);
    const discountAmount = Number(item.supplierDiscountAmountAtPurchase);
    const payout = Number(item.supplierPayoutAtPurchase);
    const commissionAmount = Number(item.commissionAmountAtPurchase);
    const discountPercent = Number(
        item.supplierDiscountPercentAtPurchase
    );
    const commissionPercent = Number(
        item.commissionPercentAtPurchase
    );

    return (
        <div className="mt-3 rounded-xl border border-[var(--color-border)] p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">
                    جزئیات مالی تأمین‌کننده
                </div>

                <div className="text-xs muted">
                    {item.supplier?.name || "تأمین‌کننده"}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <FinancialValue
                    label="قیمت پایه هر واحد"
                    value={formatToman(basePrice)}
                />

                <FinancialValue
                    label="قیمت پایه کل"
                    value={formatToman(basePrice * quantity)}
                />

                <FinancialValue
                    label="درصد تخفیف تأمین‌کننده"
                    value={formatPercent(discountPercent)}
                />

                <FinancialValue
                    label="مبلغ تخفیف هر واحد"
                    value={formatToman(discountAmount)}
                />

                <FinancialValue
                    label="مبلغ کل تخفیف تأمین‌کننده"
                    value={formatToman(discountAmount * quantity)}
                />

                <FinancialValue
                    label="مبلغ تسویه هر واحد"
                    value={formatToman(payout)}
                />

                <FinancialValue
                    label="مبلغ کل قابل پرداخت به تأمین‌کننده"
                    value={formatToman(payout * quantity)}
                />

                <FinancialValue
                    label="درصد کمیسیون برجک"
                    value={formatPercent(commissionPercent)}
                />

                <FinancialValue
                    label="مبلغ کمیسیون هر واحد"
                    value={formatToman(commissionAmount)}
                />

                <FinancialValue
                    label="مجموع کمیسیون برجک"
                    value={formatToman(commissionAmount * quantity)}
                />
            </div>
        </div>
    );
}

function InvoiceFulfillments({ order }) {
    if (
        !order.requiresPrintedInvoice ||
        order.paymentStatus !== "PAID"
    ) {
        return null;
    }

    const fulfillments = Array.isArray(order.fulfillments)
        ? order.fulfillments
        : [];

    return (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="font-bold">
                        فاکتورهای چاپی سفارش
                    </h3>

                    <p className="mt-1 text-xs muted">
                        مشتری درخواست فاکتور چاپی داده است.
                        هر مرسوله فاکتور اختصاصی خودش را دارد.
                    </p>
                </div>

                <span className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    پرداخت تأیید شده
                </span>
            </div>

            {fulfillments.length === 0 ? (
                <p className="text-sm muted">
                    برای این سفارش مرسوله‌ای ثبت نشده است.
                </p>
            ) : (
                <div className="space-y-2">
                    {fulfillments.map((fulfillment, index) => (
                        <div
                            key={fulfillment.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3"
                        >
                            <div className="min-w-0">
                                <div className="font-medium text-sm">
                                    مرسوله{" "}
                                    {(index + 1).toLocaleString("fa-IR")}
                                    {" — "}
                                    {fulfillment.supplier?.name ||
                                        "فروشگاه برجک"}
                                </div>

                                <div className="mt-1 text-xs muted">
                                    {
                                        FULFILLMENT_STATUS_LABELS[
                                            fulfillment.status
                                        ] || fulfillment.status
                                    }
                                </div>
                            </div>

                            <a
                                href={`/fulfillments/${encodeURIComponent(
                                    fulfillment.id
                                )}/invoice`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={THEME_BUTTON_CLASS}
                            >
                                <span aria-hidden="true">▤</span>
                                مشاهده و چاپ
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function OrderRow({
    order,
    expanded,
    setExpanded,
    updating,
    setConfirmOpen,
    setSelectedOrder,
    setNextStatus,
}) {
    return (
        <>
            <tr
                className="transition-colors"
                style={{
                    color: "var(--color-text)",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                        "var(--color-surface-2)";
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
                    {formatToman(order.total || 0)}
                </td>

                <td className="px-5 py-4">
                    {order.paymentStatus === "PENDING" ? (
                        <span className="px-3 py-1 rounded-xl text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400">
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
                            className={`rounded-xl px-3 py-2 text-xs font-medium border border-[var(--color-border)] cursor-pointer transition ${
                                ORDER_STATUS_COLORS[order.status] ??
                                "bg-[var(--color-surface)] text-[var(--color-text)]"
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

                <td className="px-5 py-4 muted">
                    {new Date(order.createdAt).toLocaleDateString("fa-IR")}
                </td>

                <td className="px-4 py-3">
                    <button
                        type="button"
                        onClick={() =>
                            setExpanded(
                                expanded === order.id ? null : order.id
                            )
                        }
                        aria-expanded={expanded === order.id}
                        className={THEME_BUTTON_CLASS}
                    >
                        {expanded === order.id ? "بستن" : "مشاهده"}
                    </button>
                </td>
            </tr>

            {expanded === order.id && (
                <tr>
                    <td colSpan={6} className="px-5 pb-5">
                        <div
                            className="rounded-2xl p-4 text-sm space-y-4 border"
                            style={{
                                background: "var(--color-surface-2)",
                                borderColor: "var(--color-border)",
                                color: "var(--color-text)",
                            }}
                        >
                            {order.items?.length ? (
                                order.items.map((item) => {
                                    const quantity = getQuantity(item);

                                    const customerTotal =
                                        Number(item.price || 0) * quantity;

                                    return (
                                        <div
                                            key={
                                                item.id ??
                                                `${order.id}-${item.productId}`
                                            }
                                            className="border-b last:border-b-0 border-[var(--color-border)] pb-4 last:pb-0"
                                        >
                                            <div className="flex flex-wrap justify-between gap-3">
                                                <div>
                                                    <div className="font-medium">
                                                        {item.product?.title || "محصول"}
                                                    </div>

                                                    <div className="text-xs muted mt-1">
                                                        تعداد:{" "}
                                                        {quantity.toLocaleString("fa-IR")}
                                                        {" · "}
                                                        قیمت هر واحد:{" "}
                                                        {formatToman(item.price)}
                                                    </div>
                                                </div>

                                                <div className="font-semibold">
                                                    {formatToman(customerTotal)}
                                                </div>
                                            </div>

                                            <SupplierFinancialDetails
                                                item={item}
                                                quantity={quantity}
                                            />
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="muted">
                                    آیتمی برای این سفارش ثبت نشده
                                </div>
                            )}

                            <InvoiceFulfillments order={order} />
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}

export default memo(OrderRow);
