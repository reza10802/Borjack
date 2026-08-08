"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { getAllProvinces, getCitiesByProvinceId } from "@/lib/iranLocations";

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
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

    const items = getCitiesByProvinceId(Number(form.provinceId)) || [];

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

  useEffect(() => {
    if (!user) return;

    setForm((prev) => ({
      ...prev,
      receiverName: prev.receiverName || user.name || "",
      receiverPhone: prev.receiverPhone || user.phone || "",
    }));
  }, [user]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setError("");
    setForm((prev) => ({
      ...prev,
      [name]: value,
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
    if (!form.receiverName.trim()) {
      return "نام گیرنده را وارد کن";
    }

    if (!/^09\d{9}$/.test(form.receiverPhone.trim())) {
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
      const res = await fetch("/api/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiverName: form.receiverName.trim(),
          receiverPhone: form.receiverPhone.trim(),
          provinceId: Number(form.provinceId),
          cityId: Number(form.cityId),
          address: form.address.trim(),
          postalCode: form.postalCode.trim(),
          shippingMethod: form.shippingMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "خطا در ثبت سفارش");
      }

      // اگر بک‌اند لینک پرداخت برگرداند، مستقیم برو درگاه
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // اگر فعلاً لینک پرداخت برنگشت، حداقل برو صفحه سفارشات
      if (data?.orderId) {
        router.push("/profile?tab=orders");
        return;
      }

      throw new Error("لینک پرداخت دریافت نشد");
    } catch (err) {
      setError(err.message || "خطا در ثبت سفارش");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="container mx-auto px-4 py-16">
        <p className="text-center text-gray-500">در حال بارگذاری...</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                نام گیرنده
              </label>
              <input
                type="text"
                name="receiverName"
                value={form.receiverName}
                onChange={onChange}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
                placeholder="مثلاً رضا ندایی"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
                شماره موبایل گیرنده
              </label>
              <input
                type="text"
                name="receiverPhone"
                value={form.receiverPhone}
                onChange={onChange}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
                placeholder="0912xxxxxxx"
              />
            </div>
          </div>

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

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              آدرس کامل
            </label>
            <textarea
              name="address"
              value={form.address}
              onChange={onChange}
              rows={4}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
              placeholder="آدرس دقیق، پلاک، واحد، توضیحات لازم برای ارسال"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              کد پستی
            </label>
            <input
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={onChange}
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none transition focus:border-[var(--color-accent)]"
              placeholder="کد پستی ۱۰ رقمی"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">
              روش ارسال
            </label>

            <div className="grid gap-3">

              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 cursor-pointer hover:border-[var(--color-accent)] transition">
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

              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 cursor-pointer hover:border-[var(--color-accent)] transition">
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

              <label className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 cursor-pointer hover:border-[var(--color-accent)] transition">
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

          {error && (
            <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "در حال انتقال به درگاه..." : "ثبت سفارش و ادامه پرداخت"}
          </button>
        </form>
      </div>
    </div>
  );
}