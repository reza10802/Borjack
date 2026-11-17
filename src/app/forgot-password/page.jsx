"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (char) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(char)))
    .replace(/[٠-٩]/g, (char) => String("٠١٢٣٤٥٦٧٨٩".indexOf(char)));
}

function normalizeIranPhone(value) {
  let phone = normalizeDigits(value).trim().replace(/[\s()-]/g, "");
  phone = phone.replace(/(?!^)\+/g, "");
  if (phone.startsWith("+98")) phone = phone.slice(1);
  if (/^989\d{9}$/.test(phone)) return `0${phone.slice(2)}`;
  if (/^09\d{9}$/.test(phone)) return phone;
  return null;
}

const resetOtpStorageKey = (phone) => `borjak:reset-otp:${phone}`;

function noteResetOtpRequest(phone) {
  try {
    const now = Date.now();
    const key = resetOtpStorageKey(phone);
    const previous = JSON.parse(sessionStorage.getItem(key) || "null");
    // A request made while the local cooldown is active is not a new send slot.
    if (previous?.nextAllowedAt > now) return previous;

    const sendCount = Math.max(0, Number(previous?.sendCount) || 0) + 1;
    const waitSeconds = sendCount >= 3 ? 3 * 60 * 60 : 120;
    const state = { sendCount, nextAllowedAt: now + waitSeconds * 1000 };
    sessionStorage.setItem(key, JSON.stringify(state));
    return state;
  } catch {
    return null;
  }
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone: normalizedPhone, purpose: "RESET_PASSWORD" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در درخواست کد بازیابی");

      // This is a UI hint only; the database-backed server policy remains authoritative.
      noteResetOtpRequest(normalizedPhone);
      router.push(`/reset-password?phone=${encodeURIComponent(normalizedPhone)}`);
    } catch (err) {
      setError(err?.message || "خطا در درخواست کد بازیابی");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background-app)] flex items-center justify-center px-4" dir="rtl">
      <div className="card relative w-full max-w-md p-8">
        <div className="absolute top-5 left-5"><ThemeToggle /></div>
        <h1 className="text-2xl font-black text-center mb-2 text-[var(--color-primary)] dark:text-white">
          فراموشی رمز عبور
        </h1>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          شماره موبایل حساب خود را وارد کنید تا در صورت امکان کد بازیابی برای شما ارسال شود.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(normalizeDigits(e.target.value).replace(/[^\d+]/g, "").slice(0, 13))}
            placeholder="شماره موبایل"
            autoComplete="tel"
            dir="ltr"
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-zinc-800 dark:text-zinc-100"
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={sending}
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {sending ? "در حال بررسی..." : "دریافت کد بازیابی"}
          </button>
        </form>

        <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400 text-center mt-4">
          هر کد ۲ دقیقه اعتبار دارد و سه بار امکان ورود اشتباه دارد. فاصله ارسال کدها حداقل ۲ دقیقه است؛ پس از سه ارسال، محدودیت ۳ ساعته اعمال می‌شود.
        </p>
        <div className="text-center mt-5">
          <Link href="/login" className="text-sm font-bold text-zinc-500 hover:text-[var(--color-accent)]">
            بازگشت به ورود
          </Link>
        </div>
      </div>
    </div>
  );
}
