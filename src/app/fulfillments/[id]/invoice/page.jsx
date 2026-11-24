
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount)) return "—";

  return `${amount.toLocaleString("fa-IR")} تومان`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function InvoiceRow({
  label,
  value,
  emphasis = false,
  negative = false,
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1.5 ${
        emphasis
          ? "border-t-2 border-zinc-900 pt-2.5 text-sm font-black"
          : "border-b border-zinc-200 text-xs"
      }`}
    >
      <span className={negative ? "text-emerald-700" : ""}>
        {label}
      </span>

      <span
        dir="rtl"
        className={`shrink-0 tabular-nums ${
          negative ? "text-emerald-700" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function InvoiceLoading() {
  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950"
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        در حال دریافت اطلاعات فاکتور...
      </p>
    </div>
  );
}

export default function FulfillmentInvoicePage() {
  const params = useParams();
  const fulfillmentId = String(params?.id ?? "");

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fulfillmentId) return;

    const controller = new AbortController();

    async function loadInvoice() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/fulfillments/${encodeURIComponent(fulfillmentId)}/invoice`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || "دریافت اطلاعات فاکتور ناموفق بود.",
          );
        }

        if (!data.invoice || !Array.isArray(data.invoice.items)) {
          throw new Error("اطلاعات فاکتور معتبر نیست.");
        }

        setInvoice(data.invoice);
      } catch (err) {
        if (err.name === "AbortError") return;

        setError(
          err.message || "خطا در دریافت اطلاعات فاکتور.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadInvoice();

    return () => controller.abort();
  }, [fulfillmentId]);

  if (loading) {
    return <InvoiceLoading />;
  }

  if (error || !invoice) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-zinc-100 p-6 dark:bg-zinc-950"
      >
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/60 dark:bg-zinc-900">
          <h1 className="font-bold text-red-700 dark:text-red-400">
            امکان نمایش فاکتور وجود ندارد
          </h1>

          <p className="mt-3 text-sm leading-7 text-zinc-600 dark:text-zinc-300">
            {error || "فاکتور پیدا نشد."}
          </p>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-5 rounded-xl border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            بازگشت
          </button>
        </div>
      </main>
    );
  }

  const { customer, seller, shipping, items, totals } = invoice;

  // جزئیات هزینه ارسال از Snapshot سرور دریافت می‌شوند.
  const shippingCost = Number(
    totals.shippingCost ?? shipping.cost ?? 0,
  );

  const shippingDiscount = Number(
    totals.shippingDiscount ?? shipping.discount ?? 0,
  );

  const finalShippingCost = Number(
    totals.finalShippingCost ??
      shipping.finalCost ??
      shippingCost - shippingDiscount,
  );

  const hasShippingDiscount = shippingDiscount > 0;

  return (
    <main
      dir="rtl"
      className="invoice-page min-h-screen bg-zinc-100 px-3 py-5 text-zinc-900 dark:bg-zinc-950 sm:px-6"
    >
      {/* نوار ابزار */}
      <div className="invoice-toolbar mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          <svg
            aria-hidden="true"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 8V3h10v5" />
            <path d="M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
            <path d="M7 14h10v7H7z" />
            <path d="M17 12h.01" />
          </svg>
          چاپ فاکتور
        </button>
      </div>

      {/* فاکتور A4 */}
      <article className="invoice-sheet mx-auto w-full max-w-[210mm] border border-zinc-200 bg-white p-5 text-zinc-900 shadow-sm sm:p-7">
        {/* سربرگ */}
        <header className="flex items-center justify-between gap-3 border-b-2 border-zinc-900 pb-3">
          <div className="flex items-center gap-2.5">
            <Image
              src="/images/logo2.png"
              alt="لوگوی برجک"
              width={60}
              height={60}
              priority
              className="h-12 w-12 object-contain"
            />

            <div>
              <h1 className="text-xl font-black">
                برجک
              </h1>

              <p className="mt-0.5 text-[10px] text-zinc-500">
                بازار آنلاین خرید و فروش
              </p>

              <p className="mt-1 text-[9px] text-zinc-400" dir="ltr">
                BORJAK ONLINE STORE
              </p>
            </div>
          </div>

          <div className="text-left">
            <h2 className="text-base font-black">
              فاکتور فروش
            </h2>

            <p className="mt-1 text-[11px] font-semibold text-zinc-600">
              مرسوله{" "}
              {Number(invoice.shipmentNumber).toLocaleString("fa-IR")}
              {" "}از{" "}
              {Number(invoice.shipmentCount).toLocaleString("fa-IR")}
            </p>

            <p className="mt-2 text-[10px] text-zinc-500">
              شماره فاکتور
            </p>

            <p className="mt-0.5 text-xs font-bold tabular-nums" dir="ltr">
              {invoice.invoiceNumber}
            </p>
          </div>
        </header>

        {/* اطلاعات سفارش */}
        <section className="invoice-section my-3 grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] text-zinc-500">شماره سفارش</p>
            <p className="mt-0.5 text-xs font-bold" dir="ltr">
              #{invoice.orderId}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-zinc-500">تاریخ سفارش</p>
            <p className="mt-0.5 text-[10px] font-medium">
              {formatDate(invoice.orderDate)}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-zinc-500">تاریخ پرداخت</p>
            <p className="mt-0.5 text-[10px] font-medium">
              {formatDate(invoice.paidAt)}
            </p>
          </div>

          <div>
            <p className="text-[10px] text-zinc-500">وضعیت پرداخت</p>
            <p className="mt-0.5 text-xs font-bold text-emerald-700">
              پرداخت‌شده
            </p>
          </div>
        </section>

        {/* فروشنده و خریدار */}
        <section className="invoice-section grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-200 p-3">
            <h2 className="mb-1.5 border-b border-zinc-200 pb-1.5 text-xs font-black">
              مشخصات فروشنده
            </h2>

            <p className="text-xs font-bold">
              {seller?.name || "فروشگاه برجک"}
            </p>

            <p className="mt-1 text-[10px] leading-5 text-zinc-500">
              فروشنده کالاهای این مرسوله
            </p>
          </div>

          <div className="rounded-lg border border-zinc-200 p-3">
            <h2 className="mb-1.5 border-b border-zinc-200 pb-1.5 text-xs font-black">
              مشخصات گیرنده
            </h2>

            <p className="text-xs font-bold">
              {customer.name || "—"}
            </p>

            <p className="mt-1 text-[10px]" dir="ltr">
              {customer.phone || "—"}
            </p>

            <p className="mt-1 text-[10px] leading-5 text-zinc-600">
              {[
                customer.province,
                customer.city,
                customer.address,
                customer.postalCode,
              ]
                .filter(Boolean)
                .join("، ") || "—"}
            </p>
          </div>
        </section>

        {/* جدول کالاها */}
        <section className="invoice-items-section mt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-black">
              جزئیات کالاهای این مرسوله
            </h2>

            <span className="text-[10px] text-zinc-500">
              {items.length.toLocaleString("fa-IR")} ردیف کالا
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-300">
            <table className="invoice-table w-full border-collapse text-right text-[10px]">
              <thead className="bg-zinc-100">
                <tr>
                  <th className="w-8 px-1.5 py-2 text-center">ردیف</th>
                  <th className="px-2 py-2">شرح کالا</th>
                  <th className="w-12 px-1 py-2 text-center">تعداد</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">قیمت واحد</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">تخفیف</th>
                  <th className="px-1.5 py-2 whitespace-nowrap">مبلغ نهایی</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    className="border-t border-zinc-200"
                  >
                    <td className="px-1.5 py-2 text-center">
                      {(index + 1).toLocaleString("fa-IR")}
                    </td>

                    <td className="px-2 py-2 font-medium leading-5 break-words">
                      {item.title}
                    </td>

                    <td className="px-1 py-2 text-center tabular-nums">
                      {Number(item.quantity).toLocaleString("fa-IR")}
                    </td>

                    <td className="px-1.5 py-2 whitespace-nowrap tabular-nums">
                      {formatMoney(item.unitOriginalPrice)}
                    </td>

                    <td className="px-1.5 py-2 whitespace-nowrap tabular-nums text-emerald-700">
                      {item.unitDiscount > 0
                        ? formatMoney(item.unitDiscount)
                        : "—"}
                    </td>

                    <td className="px-1.5 py-2 whitespace-nowrap font-bold tabular-nums">
                      {formatMoney(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* اطلاعات ارسال */}
        <section className="invoice-section mt-3 rounded-lg border border-zinc-200 p-3">
          <h2 className="mb-2 text-xs font-black">
            اطلاعات ارسال مرسوله
          </h2>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <div>
              <p className="text-[10px] text-zinc-500">روش ارسال</p>
              <p className="mt-0.5 text-[11px] font-semibold">
                {shipping.methodLabel}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500">
                هزینه ارسال اولیه
              </p>
              <p className="mt-0.5 text-[11px] font-semibold">
                {formatMoney(shippingCost)}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500">
                تخفیف ارسال
              </p>
              <p
                className={`mt-0.5 text-[11px] font-semibold ${
                  hasShippingDiscount ? "text-emerald-700" : ""
                }`}
              >
                {hasShippingDiscount
                  ? `− ${formatMoney(shippingDiscount)}`
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500">
                هزینه نهایی ارسال
              </p>
              <p className="mt-0.5 text-[11px] font-bold">
                {formatMoney(finalShippingCost)}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-4">
              <p className="text-[10px] text-zinc-500">کد رهگیری</p>
              <p className="mt-0.5 text-[11px] font-bold" dir="ltr">
                {shipping.trackingCode || "ثبت نشده"}
              </p>
            </div>
          </div>
        </section>

        {/* خلاصه مالی */}
        <section className="invoice-section mt-3 flex justify-center">
          <div className="w-full max-w-[350px]">
            <h2 className="mb-1.5 text-xs font-black">
              خلاصه مالی این مرسوله
            </h2>

            <InvoiceRow
              label="جمع قیمت کالاها قبل از تخفیف"
              value={formatMoney(totals.originalSubtotal)}
            />

            {totals.productDiscountTotal > 0 && (
              <InvoiceRow
                label="تخفیف محصولات"
                value={`− ${formatMoney(totals.productDiscountTotal)}`}
                negative
              />
            )}

            <InvoiceRow
              label="جمع کالاهای این مرسوله"
              value={formatMoney(totals.productSubtotal)}
            />

            {totals.storeDiscountShare > 0 && (
              <InvoiceRow
                label="سهم این مرسوله از تخفیف سفارش"
                value={`− ${formatMoney(totals.storeDiscountShare)}`}
                negative
              />
            )}

            <InvoiceRow
              label="هزینه ارسال اولیه"
              value={formatMoney(shippingCost)}
            />

            {hasShippingDiscount && (
              <InvoiceRow
                label="تخفیف ارسال"
                value={`− ${formatMoney(shippingDiscount)}`}
                negative
              />
            )}

            <InvoiceRow
              label="هزینه ارسال پس از تخفیف"
              value={formatMoney(finalShippingCost)}
            />

            <InvoiceRow
              label="مبلغ نهایی این فاکتور"
              value={formatMoney(totals.invoiceTotal)}
              emphasis
            />
          </div>
        </section>

        {/* پاورقی */}
        <footer className="invoice-section mt-4 border-t border-zinc-300 pt-2.5">
          <p className="text-center text-[10px] leading-5 text-zinc-500">
            این فاکتور فقط شامل کالاها و هزینه‌های مربوط به همین مرسوله است.
            مبالغ سایر مرسوله‌های سفارش در این سند محاسبه نشده‌اند.
          </p>

          <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-zinc-400">
            <span>برجک؛ تجربه خریدی مطمئن</span>
            <span>فاکتور شماره {invoice.invoiceNumber}</span>
          </div>
        </footer>
      </article>

      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 7mm;
        }

        @media print {
          html,
          body {
            width: auto !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #111 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          .invoice-page,
          .invoice-page * {
            visibility: visible;
          }

          .invoice-page {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            color: #111 !important;
          }

          .invoice-toolbar {
            display: none !important;
          }

          .invoice-sheet {
            width: 100% !important;
            max-width: none !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #111 !important;
          }

          .invoice-sheet header {
            padding-bottom: 8px !important;
          }

          .invoice-sheet .invoice-section {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .invoice-items-section {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

          .invoice-table {
            width: 100% !important;
            font-size: 9px !important;
          }

          .invoice-table thead {
            display: table-header-group;
          }

          .invoice-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .invoice-table th,
          .invoice-table td {
            padding: 5px 6px !important;
          }

          .invoice-sheet footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          * {
            box-shadow: none !important;
          }
        }
      `}</style>
    </main>
  );
}
