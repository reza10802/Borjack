
"use client";

import { useEffect, useState } from "react";

const EMPTY_FORM = {
  code: "",
  type: "PERCENTAGE",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "",
  description: "",
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

const TYPE_LABELS = {
  PERCENTAGE: "تخفیف درصدی",
  FIXED: "تخفیف مبلغ ثابت",
  FREE_SHIPPING: "ارسال رایگان",
};

const FILTERS = [
  { value: "all", label: "همه کوپن‌ها" },
  { value: "active", label: "فعال‌ها" },
  { value: "inactive", label: "غیرفعال‌ها" },
];

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

const persianNumberFormatter = new Intl.NumberFormat("fa-IR");

const persianMonthFormatter = new Intl.DateTimeFormat(
  "fa-IR-u-ca-persian",
  {
    year: "numeric",
    month: "long",
  },
);

const persianDateFormatter = new Intl.DateTimeFormat(
  "fa-IR-u-ca-persian",
  {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
);

const persianCalendarPartsFormatter = new Intl.DateTimeFormat(
  "en-US-u-ca-persian-nu-latn",
  {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  },
);

const WEEK_DAYS = [
  "ش",
  "ی",
  "د",
  "س",
  "چ",
  "پ",
  "ج",
];

function toPersianDigits(value) {
  return String(value).replace(
    /\d/g,
    (digit) => PERSIAN_DIGITS[Number(digit)],
  );
}

function formatMoney(value) {
  const amount = Number(value);

  if (!Number.isSafeInteger(amount)) return "—";

  return `${amount.toLocaleString("fa-IR")} تومان`;
}

function formatDate(value) {
  if (!value) return "بدون محدودیت";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return persianDateFormatter.format(date);
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  date.setMinutes(
    date.getMinutes() - date.getTimezoneOffset(),
  );

  return date.toISOString().slice(0, 16);
}

function toIsoDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function getPersianDateParts(date) {
  const parts = persianCalendarPartsFormatter.formatToParts(date);

  const getPart = (type) =>
    Number(parts.find((item) => item.type === type)?.value);

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

function getPersianMonthDays(anchorDate) {
  const target = getPersianDateParts(anchorDate);

  // شروع ماه شمسی را با حرکت به عقب در تاریخ میلادی پیدا می‌کنیم.
  const firstDay = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate(),
    12,
    0,
    0,
  );

  for (let i = 0; i < 31; i++) {
    const previousDay = new Date(firstDay);
    previousDay.setDate(previousDay.getDate() - 1);

    const parts = getPersianDateParts(previousDay);

    if (
      parts.year !== target.year ||
      parts.month !== target.month
    ) {
      break;
    }

    firstDay.setTime(previousDay.getTime());
  }

  const days = [];

  for (let i = 0; i < 32; i++) {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + i);

    const parts = getPersianDateParts(date);

    if (
      parts.year !== target.year ||
      parts.month !== target.month
    ) {
      break;
    }

    days.push({
      date,
      day: parts.day,
    });
  }

  // تقویم شمسی از شنبه شروع می‌شود.
  const leadingSpaces = (firstDay.getDay() + 1) % 7;

  const cells = [
    ...Array(leadingSpaces).fill(null),
    ...days,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function sameLocalDay(first, second) {
  if (!first || !second) return false;

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

// انتخابگر تاریخ و ساعت شمسی، مستقل از تقویم مرورگر
function PersianDateTimePicker({
  value,
  onChange,
  label,
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());

  const parsedDate = value ? new Date(value) : null;

  const selectedDate =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate
      : null;

  const hour = selectedDate?.getHours() ?? 0;
  const minute = selectedDate?.getMinutes() ?? 0;

  const calendarCells = getPersianMonthDays(viewDate);

  const changeMonth = (direction) => {
    const nextDate = new Date(viewDate);

    // حرکت به ماه شمسی بعدی یا قبلی
    nextDate.setDate(
      nextDate.getDate() + direction * 35,
    );

    setViewDate(nextDate);
  };

  const selectDate = (date) => {
    const nextDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hour,
      minute,
      0,
      0,
    );

    setViewDate(nextDate);
    onChange(nextDate.toISOString());
    setOpen(false);
  };

  const changeTime = (field, nextValue) => {
    if (!selectedDate) return;

    const nextDate = new Date(selectedDate);

    if (field === "hour") {
      nextDate.setHours(nextValue);
    } else {
      nextDate.setMinutes(nextValue);
    }

    onChange(nextDate.toISOString());
  };

  const openCalendar = () => {
    if (!open) {
      setViewDate(selectedDate || new Date());
    }

    setOpen((previous) => !previous);
  };

  const clearDate = () => {
    onChange("");
    setViewDate(new Date());
    setOpen(false);
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={openCalendar}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex min-h-[45px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm transition ${
          open
            ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/15"
            : "border-[var(--color-border)]"
        } bg-[var(--color-surface)] text-[var(--color-text)]`}
      >
        <span className="flex items-center gap-2 text-right">
          <span aria-hidden="true">📅</span>

          {selectedDate
            ? persianDateFormatter.format(selectedDate)
            : "انتخاب تاریخ و ساعت شمسی"}
        </span>

        <span className="text-xs text-[var(--color-text-muted)]">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div
          dir="rtl"
          role="dialog"
          aria-label={`انتخاب ${label}`}
          className="absolute right-0 top-full z-[90] mt-2 w-full min-w-[290px] max-w-[340px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-[var(--color-text)] shadow-2xl"
        >
          {/* Calendar header */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="ماه قبل"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] transition hover:bg-[var(--background-app)]"
            >
              ‹
            </button>

            <h3 className="text-sm font-bold">
              {persianMonthFormatter.format(viewDate)}
            </h3>

            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="ماه بعد"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] transition hover:bg-[var(--background-app)]"
            >
              ›
            </button>
          </div>

          {/* Week days */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((day, index) => (
              <div
                key={index}
                className="flex h-8 items-center justify-center text-xs font-bold text-[var(--color-text-muted)]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, index) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-9"
                  />
                );
              }

              const isSelected = sameLocalDay(
                cell.date,
                selectedDate,
              );

              const isToday = sameLocalDay(
                cell.date,
                new Date(),
              );

              return (
                <button
                  key={cell.date.toISOString()}
                  type="button"
                  onClick={() => selectDate(cell.date)}
                  aria-pressed={isSelected}
                  className={`flex h-9 items-center justify-center rounded-lg text-xs transition ${
                    isSelected
                      ? "bg-[var(--color-accent)] font-bold text-white"
                      : isToday
                        ? "border border-[var(--color-accent)] font-bold text-[var(--color-accent)]"
                        : "hover:bg-[var(--background-app)]"
                  }`}
                >
                  {toPersianDigits(cell.day)}
                </button>
              );
            })}
          </div>

          {/* Time selector */}
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="mb-3 text-xs font-semibold">
              انتخاب ساعت و دقیقه
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  ساعت
                </label>

                <select
                  disabled={!selectedDate}
                  value={hour}
                  onChange={(event) =>
                    changeTime("hour", Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-app)] px-3 py-2 text-sm text-[var(--color-text)] outline-none disabled:opacity-40"
                >
                  {Array.from({ length: 24 }, (_, index) => (
                    <option key={index} value={index}>
                      {toPersianDigits(
                        String(index).padStart(2, "0"),
                      )}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs text-[var(--color-text-muted)]">
                  دقیقه
                </label>

                <select
                  disabled={!selectedDate}
                  value={minute}
                  onChange={(event) =>
                    changeTime("minute", Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--background-app)] px-3 py-2 text-sm text-[var(--color-text)] outline-none disabled:opacity-40"
                >
                  {Array.from({ length: 60 }, (_, index) => (
                    <option key={index} value={index}>
                      {toPersianDigits(
                        String(index).padStart(2, "0"),
                      )}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedDate && (
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                ابتدا یک روز از تقویم انتخاب کن.
              </p>
            )}

            {selectedDate && (
              <p className="mt-3 rounded-lg bg-[var(--background-app)] p-2 text-center text-xs font-semibold">
                {persianDateFormatter.format(selectedDate)}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
            <button
              type="button"
              onClick={clearDate}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              حذف تاریخ
            </button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-800"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getCouponStatus(coupon) {
  if (!coupon.isActive) {
    return {
      label: "غیرفعال",
      className: "bg-zinc-500/10 text-zinc-500",
    };
  }

  const now = Date.now();

  if (
    coupon.startsAt &&
    new Date(coupon.startsAt).getTime() > now
  ) {
    return {
      label: "هنوز شروع نشده",
      className: "bg-blue-500/10 text-blue-600",
    };
  }

  if (
    coupon.expiresAt &&
    new Date(coupon.expiresAt).getTime() <= now
  ) {
    return {
      label: "منقضی‌شده",
      className: "bg-red-500/10 text-red-600",
    };
  }

  return {
    label: "فعال",
    className: "bg-emerald-500/10 text-emerald-600",
  };
}

function getCouponValue(coupon) {
  if (coupon.type === "FREE_SHIPPING") {
    return "رایگان شدن ارسال تمام مرسوله‌ها";
  }

  if (coupon.type === "PERCENTAGE") {
    return `${Number(coupon.value).toLocaleString("fa-IR")}٪`;
  }

  return formatMoney(coupon.value);
}

function getInitialForm(coupon) {
  if (!coupon) {
    return { ...EMPTY_FORM };
  }

  return {
    code: coupon.code,
    type: coupon.type,
    value:
      coupon.value === null
        ? ""
        : String(coupon.value),
    minOrderAmount: String(coupon.minOrderAmount ?? 0),
    maxDiscountAmount:
      coupon.maxDiscountAmount === null
        ? ""
        : String(coupon.maxDiscountAmount),
    description: coupon.description || "",
    startsAt: toDateTimeLocal(coupon.startsAt),
    expiresAt: toDateTimeLocal(coupon.expiresAt),
    isActive: coupon.isActive,
  };
}

function FormField({ label, children, required = false }) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
        {label}

        {required && (
          <span className="mr-1 text-red-500">*</span>
        )}
      </label>

      {children}
    </div>
  );
}

function inputClassName() {
  return "w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15";
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [reloadKey, setReloadKey] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  // دریافت کوپن‌ها از سرور
  useEffect(() => {
    let ignore = false;

    const controller = new AbortController();

    async function loadCoupons() {
      try {
        const params = new URLSearchParams({
          status,
          page: String(page),
          limit: "20",
        });

        const response = await fetch(
          `/api/admin/coupons?${params.toString()}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.error || "دریافت کوپن‌ها ناموفق بود.",
          );
        }

        if (
          data.success !== true ||
          !Array.isArray(data.coupons) ||
          !data.pagination
        ) {
          throw new Error(
            "پاسخ سرور برای فهرست کوپن‌ها معتبر نیست.",
          );
        }

        if (ignore) return;

        setCoupons(data.coupons);
        setPagination(data.pagination);
        setPageError("");
      } catch (error) {
        if (
          ignore ||
          error.name === "AbortError"
        ) {
          return;
        }

        setCoupons([]);
        setPageError(
          error.message || "خطا در دریافت کدهای تخفیف.",
        );
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadCoupons();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [status, page, reloadKey]);

  const openCreateForm = () => {
    setEditingCoupon(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (coupon) => {
    setEditingCoupon(coupon);
    setForm(getInitialForm(coupon));
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    setShowForm(false);
    setEditingCoupon(null);
    setForm({ ...EMPTY_FORM });
    setFormError("");
  };

  const changeField = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const changeType = (type) => {
    setForm((previous) => ({
      ...previous,
      type,
      value:
        type === "FREE_SHIPPING"
          ? ""
          : previous.value ||
            (type === "PERCENTAGE" ? "10" : ""),
      maxDiscountAmount:
        type === "PERCENTAGE"
          ? previous.maxDiscountAmount
          : "",
    }));

    setFormError("");
  };

  const buildPayload = () => ({
    ...(editingCoupon ? { id: editingCoupon.id } : {}),

    code: form.code.trim().toUpperCase(),
    type: form.type,

    value:
      form.type === "FREE_SHIPPING"
        ? null
        : Number(form.value),

    minOrderAmount: Number(form.minOrderAmount),

    maxDiscountAmount:
      form.type === "PERCENTAGE" &&
      form.maxDiscountAmount.trim()
        ? Number(form.maxDiscountAmount)
        : null,

    description: form.description.trim() || null,

    startsAt: toIsoDate(form.startsAt),
    expiresAt: toIsoDate(form.expiresAt),

    isActive: form.isActive,
  });

  const validateForm = () => {
    const code = form.code.trim().toUpperCase();

    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) {
      return "کد تخفیف باید ۳ تا ۴۰ کاراکتر انگلیسی، عدد، خط تیره یا زیرخط باشد.";
    }

    if (form.type !== "FREE_SHIPPING") {
      const value = Number(form.value);

      if (!Number.isSafeInteger(value) || value <= 0) {
        return "مقدار تخفیف باید یک عدد صحیح بزرگ‌تر از صفر باشد.";
      }

      if (
        form.type === "PERCENTAGE" &&
        value > 100
      ) {
        return "درصد تخفیف نباید بیشتر از ۱۰۰ باشد.";
      }
    }

    const minimum = Number(form.minOrderAmount);

    if (
      !Number.isSafeInteger(minimum) ||
      minimum < 0 ||
      minimum > 2_147_483_647
    ) {
      return "حداقل مبلغ سفارش معتبر نیست.";
    }

    if (
      form.type === "PERCENTAGE" &&
      form.maxDiscountAmount.trim()
    ) {
      const maximum = Number(form.maxDiscountAmount);

      if (
        !Number.isSafeInteger(maximum) ||
        maximum <= 0 ||
        maximum > 2_147_483_647
      ) {
        return "سقف تخفیف باید عددی صحیح و بزرگ‌تر از صفر باشد.";
      }
    }

    if (
      form.startsAt &&
      form.expiresAt &&
      new Date(form.expiresAt).getTime() <=
        new Date(form.startsAt).getTime()
    ) {
      return "تاریخ پایان باید بعد از تاریخ شروع باشد.";
    }

    if (form.description.trim().length > 500) {
      return "توضیحات نمی‌تواند بیشتر از ۵۰۰ کاراکتر باشد.";
    }

    return "";
  };

  const saveCoupon = async (event) => {
    event.preventDefault();

    if (saving) return;

    const validationError = validateForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      const response = await fetch("/api/admin/coupons", {
        method: editingCoupon ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify(buildPayload()),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || "ذخیره کوپن ناموفق بود.",
        );
      }

      if (data.success !== true || !data.coupon) {
        throw new Error(
          "پاسخ سرور برای ذخیره کوپن معتبر نیست.",
        );
      }

      setShowForm(false);
      setEditingCoupon(null);
      setForm({ ...EMPTY_FORM });
      setFormError("");

      setLoading(true);
      setPageError("");

      if (!editingCoupon) {
        setPage(1);
      }

      setReloadKey((previous) => previous + 1);
    } catch (error) {
      setFormError(
        error.message || "خطا در ذخیره کوپن.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon) => {
    if (togglingId !== null) return;

    setTogglingId(coupon.id);
    setPageError("");

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          id: coupon.id,
          isActive: !coupon.isActive,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.coupon) {
        throw new Error(
          data.error || "تغییر وضعیت کوپن ناموفق بود.",
        );
      }

      setLoading(true);
      setReloadKey((previous) => previous + 1);
    } catch (error) {
      setPageError(
        error.message || "تغییر وضعیت کوپن ناموفق بود.",
      );
    } finally {
      setTogglingId(null);
    }
  };

  const changeFilter = (nextStatus) => {
    if (nextStatus === status) return;

    setLoading(true);
    setPageError("");
    setStatus(nextStatus);
    setPage(1);
  };

  const changePage = (nextPage) => {
    if (
      nextPage < 1 ||
      nextPage > pagination.totalPages ||
      nextPage === page
    ) {
      return;
    }

    setLoading(true);
    setPageError("");
    setPage(nextPage);
  };

  const reloadCoupons = () => {
    setLoading(true);
    setPageError("");
    setReloadKey((previous) => previous + 1);
  };

  return (
    <div
      dir="rtl"
      className="mx-auto max-w-7xl space-y-6 text-[var(--color-text)]"
    >
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">
            مدیریت کدهای تخفیف
          </h1>

          <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)]">
            ایجاد و مدیریت تخفیف‌های فروشگاه برجک؛ شامل تخفیف درصدی،
            مبلغ ثابت و ارسال رایگان.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="btn-primary w-full rounded-xl px-5 py-3 text-sm font-semibold sm:w-auto"
        >
          + ایجاد کد تخفیف
        </button>
      </header>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            تعداد در این فهرست
          </p>

          <p className="mt-2 text-2xl font-bold tabular-nums">
            {pagination.total.toLocaleString("fa-IR")}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            فیلتر فعلی
          </p>

          <p className="mt-2 text-lg font-bold">
            {FILTERS.find(
              (item) => item.value === status,
            )?.label}
          </p>
        </div>

        <div className="card col-span-2 p-4 sm:col-span-1">
          <p className="text-xs text-[var(--color-text-muted)]">
            صفحه
          </p>

          <p className="mt-2 text-lg font-bold tabular-nums">
            {pagination.page.toLocaleString("fa-IR")}
            {" از "}
            {pagination.totalPages.toLocaleString("fa-IR")}
          </p>
        </div>
      </section>

      {/* Create/Edit form */}
      {showForm && (
        <section className="card space-y-5 border border-[var(--color-accent)]/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                {editingCoupon
                  ? "ویرایش کد تخفیف"
                  : "ایجاد کد تخفیف جدید"}
              </h2>

              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                فیلدهای ستاره‌دار الزامی هستند.
              </p>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--background-app)] disabled:opacity-50"
            >
              بستن
            </button>
          </div>

          <form
            onSubmit={saveCoupon}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="کد تخفیف" required>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={40}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.code}
                  onChange={(event) =>
                    changeField(
                      "code",
                      event.target.value.toUpperCase(),
                    )
                  }
                  placeholder="WELCOME20"
                  className={`${inputClassName()} text-left font-semibold uppercase tracking-wider`}
                  required
                />

                <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                  ۳ تا ۴۰ کاراکتر؛ حروف انگلیسی، عدد، خط تیره و زیرخط.
                </p>
              </FormField>

              <FormField label="نوع تخفیف" required>
                <select
                  value={form.type}
                  onChange={(event) =>
                    changeType(event.target.value)
                  }
                  className={inputClassName()}
                >
                  <option value="PERCENTAGE">
                    تخفیف درصدی
                  </option>

                  <option value="FIXED">
                    تخفیف مبلغ ثابت
                  </option>

                  <option value="FREE_SHIPPING">
                    ارسال رایگان تمام مرسوله‌ها
                  </option>
                </select>
              </FormField>

              {form.type !== "FREE_SHIPPING" && (
                <FormField
                  label={
                    form.type === "PERCENTAGE"
                      ? "درصد تخفیف"
                      : "مبلغ تخفیف به تومان"
                  }
                  required
                >
                  <input
                    type="number"
                    min="1"
                    max={
                      form.type === "PERCENTAGE"
                        ? "100"
                        : "2147483647"
                    }
                    step="1"
                    value={form.value}
                    onChange={(event) =>
                      changeField("value", event.target.value)
                    }
                    className={inputClassName()}
                    placeholder={
                      form.type === "PERCENTAGE"
                        ? "مثلاً ۲۰"
                        : "مثلاً ۱۰۰۰۰۰"
                    }
                  />
                </FormField>
              )}

              {form.type === "PERCENTAGE" && (
                <FormField label="سقف تخفیف به تومان (اختیاری)">
                  <input
                    type="number"
                    min="1"
                    max="2147483647"
                    step="1"
                    value={form.maxDiscountAmount}
                    onChange={(event) =>
                      changeField(
                        "maxDiscountAmount",
                        event.target.value,
                      )
                    }
                    className={inputClassName()}
                    placeholder="بدون سقف"
                  />
                </FormField>
              )}

              <FormField label="حداقل مبلغ سفارش به تومان">
                <input
                  type="number"
                  min="0"
                  max="2147483647"
                  step="1"
                  value={form.minOrderAmount}
                  onChange={(event) =>
                    changeField(
                      "minOrderAmount",
                      event.target.value,
                    )
                  }
                  className={inputClassName()}
                />
              </FormField>

              <FormField label="وضعیت اولیه">
                <select
                  value={form.isActive ? "true" : "false"}
                  onChange={(event) =>
                    changeField(
                      "isActive",
                      event.target.value === "true",
                    )
                  }
                  className={inputClassName()}
                >
                  <option value="true">فعال</option>
                  <option value="false">غیرفعال</option>
                </select>
              </FormField>

              <FormField label="شروع اعتبار (اختیاری)">
                <PersianDateTimePicker
                  label="شروع اعتبار"
                  value={form.startsAt}
                  onChange={(value) =>
                    changeField("startsAt", value)
                  }
                />
              </FormField>

              <FormField label="پایان اعتبار (اختیاری)">
                <PersianDateTimePicker
                  label="پایان اعتبار"
                  value={form.expiresAt}
                  onChange={(value) =>
                    changeField("expiresAt", value)
                  }
                />
              </FormField>
            </div>

            <FormField label="توضیحات کوپن (اختیاری)">
              <textarea
                rows={3}
                maxLength={500}
                value={form.description}
                onChange={(event) =>
                  changeField("description", event.target.value)
                }
                className={`${inputClassName()} resize-y`}
                placeholder="توضیح کوتاهی درباره این کد تخفیف..."
              />
            </FormField>

            {form.type === "FREE_SHIPPING" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm leading-6 text-emerald-700 dark:text-emerald-400">
                با این کد، هزینه ارسال تمام مرسوله‌های همان سفارش
                رایگان می‌شود. این تخفیف از سهم مالی کالاها یا
                تسویه تأمین‌کنندگان کم نمی‌کند.
              </div>
            )}

            {form.type === "PERCENTAGE" && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--background-app)] p-3 text-sm leading-6 text-[var(--color-text-muted)]">
                تخفیف درصدی از مبلغ کالاها محاسبه می‌شود. در صورت
                تعیین سقف، مبلغ تخفیف از سقف مشخص‌شده بیشتر نخواهد شد.
              </div>
            )}

            {form.type === "FIXED" && (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--background-app)] p-3 text-sm leading-6 text-[var(--color-text-muted)]">
                مبلغ ثابت از ارزش کالاهای سفارش کم می‌شود و در
                صورت کمتر بودن ارزش کالاها، تخفیف تا همان مبلغ کالا
                محدود خواهد شد.
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-600"
              >
                {formError}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--background-app)] disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="submit"
                disabled={saving}
                className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "در حال ذخیره..."
                  : editingCoupon
                    ? "ذخیره تغییرات"
                    : "ایجاد کد تخفیف"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Filters */}
      <section className="card flex flex-wrap gap-2 p-3">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => changeFilter(item.value)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              status === item.value
                ? "btn-primary"
                : "border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--background-app)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </section>

      {/* Errors */}
      {pageError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600"
        >
          {pageError}

          <button
            type="button"
            onClick={reloadCoupons}
            className="mr-3 font-bold underline"
          >
            تلاش دوباره
          </button>
        </div>
      )}

      {/* Coupon list */}
      <section className="space-y-3">
        {loading ? (
          [...Array(3)].map((_, index) => (
            <div
              key={index}
              className="card h-36 animate-pulse"
            />
          ))
        ) : coupons.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-semibold">
              کوپنی در این فهرست وجود ندارد.
            </p>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              با دکمه «ایجاد کد تخفیف» اولین کوپن فروشگاه را بساز.
            </p>
          </div>
        ) : (
          coupons.map((coupon) => {
            const couponStatus = getCouponStatus(coupon);

            return (
              <article
                key={coupon.id}
                className="card space-y-4 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--background-app)] px-3 py-1.5 font-mono text-sm font-bold tracking-wider"
                      >
                        {coupon.code}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${couponStatus.className}`}
                      >
                        {couponStatus.label}
                      </span>
                    </div>

                    <p className="text-sm font-semibold">
                      {TYPE_LABELS[coupon.type] || coupon.type}
                    </p>

                    <p className="text-sm text-[var(--color-text-muted)]">
                      {getCouponValue(coupon)}
                    </p>

                    {coupon.description && (
                      <p className="break-words text-xs leading-6 text-[var(--color-text-muted)]">
                        {coupon.description}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(coupon)}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                    >
                      ویرایش
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCoupon(coupon)}
                      disabled={togglingId !== null}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition disabled:opacity-50 ${
                        coupon.isActive
                          ? "border-red-500/30 text-red-600 hover:bg-red-500/10"
                          : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                      }`}
                    >
                      {togglingId === coupon.id
                        ? "در حال ذخیره..."
                        : coupon.isActive
                          ? "غیرفعال‌کردن"
                          : "فعال‌کردن"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      حداقل سفارش
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {formatMoney(coupon.minOrderAmount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      سقف تخفیف
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {coupon.maxDiscountAmount === null
                        ? "—"
                        : formatMoney(coupon.maxDiscountAmount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      سفارش‌های مرتبط
                    </p>

                    <p className="mt-1 text-sm font-semibold tabular-nums">
                      {Number(coupon.orderCount ?? 0).toLocaleString("fa-IR")}
                    </p>
                  </div>

                  <div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      اعتبار
                    </p>

                    <p className="mt-1 text-xs leading-6">
                      {formatDate(coupon.startsAt)}
                      <span className="mx-1">تا</span>
                      {formatDate(coupon.expiresAt)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between gap-2 border-t border-[var(--color-border)] pt-3 text-[11px] text-[var(--color-text-muted)]">
                  <span>
                    ایجاد: {formatDate(coupon.createdAt)}
                  </span>

                  <span>
                    آخرین ویرایش: {formatDate(coupon.updatedAt)}
                  </span>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="card flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
          <p className="text-xs text-[var(--color-text-muted)]">
            صفحه{" "}
            {pagination.page.toLocaleString("fa-IR")}
            {" از "}
            {pagination.totalPages.toLocaleString("fa-IR")}
            {" — "}
            {pagination.total.toLocaleString("fa-IR")}
            {" کوپن"}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => changePage(page - 1)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              قبلی
            </button>

            <button
              type="button"
              disabled={page >= pagination.totalPages}
              onClick={() => changePage(page + 1)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              بعدی
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
