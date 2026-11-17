
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import {
  getAllProvinces,
  getCitiesByProvinceId,
} from "@/lib/iranLocations";

export default function CheckoutPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [form, setForm] = useState({
    receiverName: "",
    receiverPhone: "",
    provinceId: "",
    cityId: "",
    address: "",
    postalCode: "",
    shippingMethod: "POST",
    requiresPrintedInvoice: false,
  });

  const [receiverNameEdited, setReceiverNameEdited] = useState(false);
  const [receiverPhoneEdited, setReceiverPhoneEdited] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // مقادیر پیش‌فرض از اطلاعات کاربر، بدون setState در effect
  const receiverName = receiverNameEdited
    ? form.receiverName
    : user?.name || form.receiverName;

  const receiverPhone = receiverPhoneEdited
    ? form.receiverPhone
    : user?.phone || form.receiverPhone;

  // استان‌ها
  const provinces = useMemo(() => {
    const items = getAllProvinces() || [];

    return items.map((item) => ({
      value: String(item.id),
      label: item.name,
    }));
  }, []);

  // شهرها بر اساس استان انتخاب شده
  const cityOptions = useMemo(() => {
    if (!form.provinceId) return [];

    const items =
      getCitiesByProvinceId(Number(form.provinceId)) || [];

    return items.map((item) => ({
      value: String(item.id),
      label: item.name,
    }));
  }, [form.provinceId]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/checkout");
    }
  }, [loading, user, router]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;

    setError("");

    if (name === "receiverName") {
      setReceiverNameEdited(true);
    }

    if (name === "receiverPhone") {
      setReceiverPhoneEdited(true);
    }

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleProvinceChange = (value) => {
    setError("");

    setForm((prev) => ({
      ...prev,
      provinceId: value,
      cityId: "",
    }));
  };

  const handleCityChange = (value) => {
    setError("");

    setForm((prev) => ({
      ...prev,
      cityId: value,
    }));
  };

  const validateForm = () => {
    if (!receiverName.trim()) {
      return "نام گیرنده را وارد کن";
    }

    if (!/^09\d{9}$/.test(receiverPhone.trim())) {
      return "شماره موبایل گیرنده معتبر نیست";
    }

    if (!form.provinceId) {
      return "استان را انتخاب کن";
    }

    if (!form.cityId) {
      return "شهر را انتخاب کن";
    }

    if (form.address.trim().length < 10) {
      return "آدرس باید حداقل ۱۰ کاراکتر باشد";
    }

    if (!/^\d{10}$/.test(form.postalCode.trim())) {
      return "کد پستی باید ۱۰ رقم باشد";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      // ثبت سفارش
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim(),
          provinceId: Number(form.provinceId),
          cityId: Number(form.cityId),
          address: form.address.trim(),
          postalCode: form.postalCode.trim(),
          shippingMethod: form.shippingMethod,
          requiresPrintedInvoice: form.requiresPrintedInvoice,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "خطا در ثبت سفارش");
      }

      if (!data?.orderId) {
        throw new Error("شناسه سفارش دریافت نشد.");
      }

      // شروع پرداخت
      const paymentRes = await fetch("/api/payment/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId: data.orderId,
        }),
      });

      const paymentData = await paymentRes.json();

      if (!paymentRes.ok || !paymentData?.paymentUrl) {
        throw new Error(
          paymentData.error || "شروع پرداخت ناموفق بود."
        );
      }

      // انتقال به درگاه
      window.location.assign(paymentData.paymentUrl);
    } catch (err) {
      setError(err.message || "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <p className="text-center text-gray-500">
          در حال بارگذاری...
        </p>
      </div>
    );
  }

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="card p-6 md:p-8">
        <h1 className="section-title mb-6 text-[var(--color-text)]">
          تکمیل اطلاعات سفارش
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* اطلاعات گیرنده */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="receiverName"
                className="mb-2 block text-sm font-medium text-[var(--color-text)]"
              >
                نام گیرنده
              </label>

              <input
                id="receiverName"
                type="text"
                name="receiverName"
                value={receiverName}
                onChange={onChange}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
                placeholder="مثلاً رضا ندایی"
              />
            </div>

            <div>
              <label
                htmlFor="receiverPhone"
                className="mb-2 block text-sm font-medium text-[var(--color-text)]"
              >
                شماره موبایل گیرنده
              </label>

              <input
                id="receiverPhone"
                type="text"
                name="receiverPhone"
                value={receiverPhone}
                onChange={onChange}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
                placeholder="0912xxxxxxx"
              />
            </div>
          </div>

          {/* استان و شهر */}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                استان
              </label>

              <Select
                value={form.provinceId}
                onChange={handleProvinceChange}
                options={provinces}
                placeholder="انتخاب استان"
                instanceId="checkout-province"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                شهر
              </label>

              <Select
                value={form.cityId}
                onChange={handleCityChange}
                options={cityOptions}
                isDisabled={!form.provinceId}
                placeholder={
                  form.provinceId
                    ? "انتخاب شهر"
                    : "ابتدا استان را انتخاب کنید"
                }
                instanceId="checkout-city"
              />
            </div>
          </div>

          {/* آدرس */}
          <div>
            <label
              htmlFor="address"
              className="mb-2 block text-sm font-medium text-[var(--color-text)]"
            >
              آدرس کامل
            </label>

            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={onChange}
              rows={4}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
              placeholder="آدرس دقیق، پلاک، واحد، توضیحات لازم برای ارسال"
            />
          </div>

          {/* کد پستی */}
          <div>
            <label
              htmlFor="postalCode"
              className="mb-2 block text-sm font-medium text-[var(--color-text)]"
            >
              کد پستی
            </label>

            <input
              id="postalCode"
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={onChange}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
              placeholder="کد پستی ۱۰ رقمی"
            />
          </div>

          {/* روش ارسال */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              روش ارسال
            </label>

            <div className="grid gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="POST"
                  checked={form.shippingMethod === "POST"}
                  onChange={onChange}
                />

                <div>
                  <p className="font-bold">پست پیشتاز</p>
                  <p className="text-sm text-zinc-500">
                    ارسال به سراسر کشور (۲ تا ۵ روز کاری)
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="TIPAX"
                  checked={form.shippingMethod === "TIPAX"}
                  onChange={onChange}
                />

                <div>
                  <p className="font-bold">تیپاکس</p>
                  <p className="text-sm text-zinc-500">
                    سریع‌تر از پست، هزینه هنگام ارسال محاسبه می‌شود.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
                <input
                  type="radio"
                  name="shippingMethod"
                  value="SNAPPBOX"
                  checked={form.shippingMethod === "SNAPPBOX"}
                  onChange={onChange}
                />

                <div>
                  <p className="font-bold">اسنپ باکس</p>
                  <p className="text-sm text-zinc-500">
                    فقط برای شهر تهران (ارسال همان روز)
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* درخواست فاکتور چاپی */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition hover:border-[var(--color-accent)]">
            <label
              htmlFor="requiresPrintedInvoice"
              className="flex cursor-pointer items-start gap-3"
            >
              <input
                id="requiresPrintedInvoice"
                name="requiresPrintedInvoice"
                type="checkbox"
                checked={form.requiresPrintedInvoice}
                onChange={onChange}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--color-accent)]"
              />

              <span>
                <span className="block font-bold text-[var(--color-text)]">
                  درخواست فاکتور چاپی
                </span>

                <span className="mt-1 block text-sm leading-6 text-[var(--color-text-muted)]">
                  در صورت انتخاب این گزینه، فاکتور سفارش چاپ شده و همراه بسته برای شما ارسال خواهد شد.
                </span>
              </span>
            </label>
          </div>

          {/* خطا */}
          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* ثبت سفارش */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "در حال انتقال به درگاه..."
              : "ثبت سفارش و ادامه پرداخت"}
          </button>
        </form>
      </div>
    </div>
  );
}
