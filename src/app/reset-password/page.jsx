"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { Suspense } from "react";

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

function formatWait(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

const resetOtpStorageKey = (phone) => `borjak:reset-otp:${phone}`;

function readResetOtpWait(phone) {
  try {
    const state = JSON.parse(sessionStorage.getItem(resetOtpStorageKey(phone)) || "null");
    return Math.max(0, Math.ceil(((Number(state?.nextAllowedAt) || 0) - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

function noteResetOtpRequest(phone) {
  try {
    const now = Date.now();
    const key = resetOtpStorageKey(phone);
    const previous = JSON.parse(sessionStorage.getItem(key) || "null");
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

function deferResetOtpRequest(phone, seconds) {
  try {
    const key = resetOtpStorageKey(phone);
    const previous = JSON.parse(sessionStorage.getItem(key) || "null");
    const state = {
      sendCount: Math.max(0, Number(previous?.sendCount) || 0),
      nextAllowedAt: Date.now() + Math.max(1, Number(seconds) || 1) * 1000,
    };
    sessionStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Session storage is only a user-interface hint; the server enforces limits.
  }
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = useMemo(
    () => normalizeIranPhone(searchParams.get("phone") || ""),
    [searchParams],
  );

  const [step, setStep] = useState("CHECKING");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Recover step two after a page refresh. The grant cookie is HttpOnly and
  // the API returns only whether this browser still owns a valid grant.
  useEffect(() => {
    if (!phone) {
      setStep("OTP");
      return;
    }
    setWait(readResetOtpWait(phone));
    let active = true;
    fetch(`/api/auth/reset-password?phone=${encodeURIComponent(phone)}`, { method: "GET", credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (active) setStep(data.authorized ? "PASSWORD" : "OTP");
      })
      .catch(() => {
        if (active) setStep("OTP");
      });
    return () => { active = false; };
  }, [phone]);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setInterval(() => setWait((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait > 0]);

  const verifyCode = async (e) => {
    e.preventDefault();
    const cleanCode = normalizeDigits(code).replace(/\D/g, "").slice(0, 6);
    if (!/^\d{6}$/.test(cleanCode)) {
      setError("کد تأیید باید ۶ رقم باشد.");
      return;
    }
    if (!phone) {
      setError("شماره موبایل معتبر نیست.");
      return;
    }

    setError("");
    setNotice("");
    setVerifying(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, code: cleanCode, purpose: "RESET_PASSWORD" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "کد تأیید معتبر نیست.");
      setStep("PASSWORD");
      setCode("");
      setNotice("شماره تأیید شد. حالا رمز جدید را انتخاب کنید.");
    } catch (err) {
      setError(err?.message || "خطا در تأیید کد.");
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    if (!phone || wait > 0 || sending || step !== "OTP") return;
    setError("");
    setNotice("");
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, purpose: "RESET_PASSWORD" }),
      });
      const data = await res.json();
      if (!res.ok) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 0;
        if (retryAfter) {
          const safeRetryAfter = Math.min(10800, retryAfter);
          setWait(safeRetryAfter);
          deferResetOtpRequest(phone, safeRetryAfter);
        }
        throw new Error(data?.error || "درخواست کد با محدودیت مواجه شد.");
      }
      noteResetOtpRequest(phone);
      setWait(readResetOtpWait(phone));
      setCode("");
      setNotice("درخواست بررسی شد. اگر شماره در برجک ثبت شده و محدودیت ارسال فعال نباشد، پیامک ارسال می‌شود.");
    } catch (err) {
      const retryAfter = Number(err?.retryAfter) || 0;
      if (retryAfter) setWait(Math.min(10800, retryAfter));
      setError(err?.message || "خطا در درخواست مجدد کد.");
    } finally {
      setSending(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (password.length < 8) {
      setError("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (password !== passwordRepeat) {
      setError("تکرار رمز عبور با رمز جدید مطابقت ندارد.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setStep("OTP");
        throw new Error(data?.error || "خطا در تغییر رمز عبور.");
      }
      try { sessionStorage.removeItem(resetOtpStorageKey(phone)); } catch { /* UI hint only */ }
      router.replace("/login?reset=success");
    } catch (err) {
      setError(err?.message || "خطا در تغییر رمز عبور.");
      if (err?.status === 401) setStep("OTP");
    } finally {
      setSaving(false);
    }
  };

  if (!phone) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="card p-8 text-center">
          <p className="text-sm text-red-500">شماره موبایل معتبر نیست.</p>
          <button onClick={() => router.replace("/forgot-password")} className="btn-primary mt-4 px-5 py-2 rounded-xl">
            درخواست دوباره کد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background-app)] flex items-center justify-center px-4" dir="rtl">
      <div className="card relative w-full max-w-md p-8">
        <div className="absolute top-5 left-5"><ThemeToggle /></div>
        <h1 className="text-2xl font-black text-center mb-2 text-[var(--color-primary)] dark:text-white">
          {step === "PASSWORD" ? "انتخاب رمز جدید" : "تأیید شماره موبایل"}
        </h1>
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          شماره <span dir="ltr" className="font-bold">{phone}</span>
        </p>

        {step === "CHECKING" ? (
          <p className="text-center text-sm text-zinc-500">در حال بررسی مجوز بازیابی...</p>
        ) : step === "OTP" ? (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              کد شش‌رقمی پیامک‌شده را وارد کنید. هر کد ۲ دقیقه اعتبار و حداکثر ۳ بار فرصت ورود دارد.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="کد ۶ رقمی"
              value={code}
              onChange={(e) => setCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
              dir="ltr"
              disabled={verifying || sending}
              className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-lg tracking-widest text-zinc-800 dark:text-zinc-100"
            />
            <button type="submit" disabled={verifying || code.length !== 6} className="btn-primary w-full h-12 rounded-2xl font-bold disabled:opacity-50">
              {verifying ? "در حال بررسی کد..." : "تأیید کد"}
            </button>
            <button type="button" onClick={resendCode} disabled={sending || wait > 0} className="w-full h-11 rounded-2xl border border-zinc-300 dark:border-zinc-700 text-sm font-bold disabled:opacity-50">
              {sending ? "در حال بررسی درخواست..." : wait > 0 ? `درخواست مجدد پس از ${formatWait(wait)}` : "ارسال مجدد کد"}
            </button>
            <p className="text-xs leading-6 text-zinc-500 dark:text-zinc-400 text-center">
              فاصله ارسال کدها حداقل ۲ دقیقه است. پس از سه ارسال، برای دریافت کد بعدی محدودیت ۳ ساعته اعمال می‌شود. این شمارنده در سرور اعمال می‌شود؛ شمارشگر این صفحه فقط برای نمایش زمان تقریبی است.
            </p>
          </form>
        ) : (
          <form onSubmit={savePassword} className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
              مالکیت شماره تأیید شد. رمز جدیدتان را وارد کنید.
            </p>
            <input
              type="password"
              placeholder="رمز عبور جدید"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={saving}
              className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
            />
            <input
              type="password"
              placeholder="تکرار رمز عبور جدید"
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              disabled={saving}
              className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
            />
            <button type="submit" disabled={saving || password.length < 8 || !passwordRepeat} className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50">
              {saving ? "در حال ثبت رمز جدید..." : "ثبت رمز جدید"}
            </button>
            <p className="text-xs text-zinc-500 text-center">مجوز تغییر رمز فقط ۱۰ دقیقه اعتبار دارد و یک‌بارمصرف است.</p>
          </form>
        )}

        {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
        {notice && <p className="text-emerald-600 dark:text-emerald-400 text-sm text-center mt-4">{notice}</p>}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
