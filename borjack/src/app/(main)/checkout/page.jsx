"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "react-select";
import { useAuth } from "@/context/AuthContext";
import { getAllProvinces, getCitiesByProvinceId } from "@/lib/iranLocations";

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "48px",
    borderRadius: "14px",
    borderColor: state.isFocused ? "#111827" : "#e5e7eb",
    boxShadow: "none",
    direction: "rtl",
    textAlign: "right",
    "&:hover": {
      borderColor: "#111827",
    },
  }),
  menu: (base) => ({
    ...base,
    zIndex: 9999,
    direction: "rtl",
    textAlign: "right",
  }),
  menuList: (base) => ({
    ...base,
    direction: "rtl",
    textAlign: "right",
  }),
  option: (base, state) => ({
    ...base,
    direction: "rtl",
    textAlign: "right",
    backgroundColor: state.isFocused ? "#f3f4f6" : "#fff",
    color: "#111827",
    cursor: "pointer",
  }),
  singleValue: (base) => ({
    ...base,
    direction: "rtl",
    textAlign: "right",
  }),
  input: (base) => ({
    ...base,
    direction: "rtl",
    textAlign: "right",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#9ca3af",
    textAlign: "right",
  }),
};

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

  const selectedProvince =
    provinces.find((item) => item.value === String(form.provinceId)) || null;

  const selectedCity =
    cityOptions.find((item) => item.value === String(form.cityId)) || null;

  const onChange = (e) => {
    const { name, value } = e.target;
    setError("");
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProvinceChange = (option) => {
    setError("");
    setForm((prev) => ({
      ...prev,
      provinceId: option ? String(option.value) : "",
      cityId: "",
    }));
  };

  const handleCityChange = (option) => {
    setError("");
    setForm((prev) => ({
      ...prev,
      cityId: option ? String(option.value) : "",
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
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          تکمیل اطلاعات سفارش
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                نام گیرنده
              </label>
              <input
                type="text"
                name="receiverName"
                value={form.receiverName}
                onChange={onChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-black"
                placeholder="مثلاً رضا ندایی"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                شماره موبایل گیرنده
              </label>
              <input
                type="text"
                name="receiverPhone"
                value={form.receiverPhone}
                onChange={onChange}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-black"
                placeholder="0912xxxxxxx"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                استان
              </label>
              <Select
                options={provinces}
                value={selectedProvince}
                onChange={handleProvinceChange}
                isSearchable
                placeholder="انتخاب استان"
                noOptionsMessage={() => "موردی پیدا نشد"}
                styles={selectStyles}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                شهر
              </label>
              <Select
                options={cityOptions}
                value={selectedCity}
                onChange={handleCityChange}
                isSearchable
                isDisabled={!form.provinceId}
                placeholder={
                  form.provinceId ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"
                }
                noOptionsMessage={() => "موردی پیدا نشد"}
                styles={selectStyles}
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              آدرس کامل
            </label>
            <textarea
              name="address"
              value={form.address}
              onChange={onChange}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-black"
              placeholder="آدرس دقیق، پلاک، واحد، توضیحات لازم برای ارسال"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              کد پستی
            </label>
            <input
              type="text"
              name="postalCode"
              value={form.postalCode}
              onChange={onChange}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-black"
              placeholder="کد پستی ۱۰ رقمی"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-black py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "در حال انتقال به درگاه..." : "ثبت سفارش و ادامه پرداخت"}
          </button>
        </form>
      </div>
    </div>
  );
}