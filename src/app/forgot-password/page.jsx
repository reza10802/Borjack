"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

const RESEND_COOLDOWN = 120;

// تبدیل اعداد فارسی و عربی به انگلیسی
function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (char) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(char))
    )
    .replace(/[٠-٩]/g, (char) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(char))
    );
}

// تبدیل شماره ایران به فرمت استاندارد:
// 09xxxxxxxxx
function normalizeIranPhone(value) {
  let phone = normalizeDigits(value);

  // حذف فاصله، خط تیره و پرانتز
  phone = phone.replace(/[\s()-]/g, "");

  // فقط + در ابتدای شماره مجاز است
  phone = phone.replace(/(?!^)\+/g, "");

  // +989xxxxxxxxx → 989xxxxxxxxx
  if (phone.startsWith("+98")) {
    phone = phone.slice(1);
  }

  // 989xxxxxxxxx → 09xxxxxxxxx
  if (/^989\d{9}$/.test(phone)) {
    return `0${phone.slice(2)}`;
  }

  // 09xxxxxxxxx
  if (/^09\d{9}$/.test(phone)) {
    return phone;
  }

  return null;
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    const normalizedPhone = normalizeIranPhone(phone);

    if (!normalizedPhone) {
      setError("شماره موبایل معتبر نیست");
      return;
    }

    setSending(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: normalizedPhone,
          purpose: "RESET_PASSWORD",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "خطا در ارسال کد");
      }

      setCooldown(RESEND_COOLDOWN);

      router.push(
        `/reset-password?phone=${encodeURIComponent(
          normalizedPhone
        )}`
      );
    } catch (err) {
      setError(err?.message || "خطا در ارسال کد");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--background-app)] flex items-center justify-center px-4"
      dir="rtl"
    >
      <div className="card relative w-full max-w-md p-8">
        <div className="absolute top-5 left-5">
          <ThemeToggle />
        </div>

        <h1 className="text-2xl font-black text-center mb-2 text-[var(--color-primary)] dark:text-white">
          فراموشی رمز عبور
        </h1>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          شماره موبایل حساب خود را وارد کنید تا کد بازیابی برای شما ارسال شود.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => {
              const value = normalizeDigits(e.target.value)
                .replace(/[^\d+]/g, "")
                .slice(0, 13);

              setPhone(value);
            }}
            placeholder="شماره موبایل"
            autoComplete="tel"
            dir="ltr"
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-zinc-800 dark:text-zinc-100"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending || cooldown > 0}
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {sending
              ? "در حال ارسال..."
              : "ارسال کد بازیابی"}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link
            href="/login"
            className="text-sm font-bold text-zinc-500 hover:text-[var(--color-accent)]"
          >
            بازگشت به ورود
          </Link>
        </div>
      </div>
    </div>
  );
}