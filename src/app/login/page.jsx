"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import TurnstileCaptcha from "@/components/TurnstileCaptcha";

function getSafeRedirect(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  if (value.startsWith("/login") || value.startsWith("/verify-phone")) {
    return "/";
  }

  return value;
}

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

// تبدیل شماره ایران به فرمت استاندارد دیتابیس:
// 09xxxxxxxxx
function normalizeIranPhone(value) {
  let phone = normalizeDigits(value);

  // حذف فاصله، خط تیره و پرانتز
  phone = phone.replace(/[\s()-]/g, "");

  // فقط + ابتدای شماره مجاز است
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

function LoginContent() {
  const { login, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = getSafeRedirect(searchParams.get("redirect"));

  const [phone, setPhone] = useState(() => searchParams.get("phone") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [requiresLoginVerification, setRequiresLoginVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [requiresCaptcha, setRequiresCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaWidgetKey, setCaptchaWidgetKey] = useState(0);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const normalizedPhone = normalizeIranPhone(phone);

    if (!normalizedPhone) {
      setError("شماره موبایل معتبر نیست");
      return;
    }

    if (!requiresLoginVerification && !password) {
      setError("رمز عبور را وارد کنید");
      return;
    }
    if (!requiresLoginVerification && requiresCaptcha && !captchaToken) {
      setError("ابتدا تأیید امنیتی را کامل کنید.");
      return;
    }
    if (requiresLoginVerification && !/^\d{6}$/.test(normalizeDigits(otpCode))) {
      setError("کد تأیید باید ۶ رقم باشد");
      return;
    }

    setLoading(true);

    try {
      if (requiresLoginVerification) {
        const res = await fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({ phone: normalizedPhone, code: normalizeDigits(otpCode), purpose: "LOGIN" }),
        });
        const verified = await res.json();
        if (!res.ok) throw new Error(verified?.error || "کد تأیید نامعتبر است");
        const refreshedUser = await refreshUser();
        if (!refreshedUser) throw new Error("ورود تأیید شد اما دریافت نشست کامل نشد. دوباره وارد شوید.");
        router.replace(redirect);
        return;
      }

      const data = await login(normalizedPhone, password, captchaToken);

      if (data?.requiresLoginVerification) {
        setRequiresLoginVerification(true);
        setRequiresCaptcha(false);
        setCaptchaToken("");
        setOtpCode("");
        setNotice(data.message || "کد تأیید ورود برای شما ارسال شد.");
        return;
      }

      setRequiresCaptcha(false);
      setCaptchaToken("");

      // کاربر وارد شده ولی شماره موبایل هنوز تأیید نشده
      if (!data?.isPhoneVerified) {
        router.replace(
          `/verify-phone?phone=${encodeURIComponent(
            normalizedPhone
          )}&redirect=${encodeURIComponent(redirect)}`
        );
        return;
      }

      // کاربر تأیید شده
      router.replace(redirect);
    } catch (err) {
      if (err?.requiresCaptcha) {
        setRequiresCaptcha(true);
        setCaptchaToken("");
        setCaptchaWidgetKey((value) => value + 1);
      }
      setError(err?.message || "شماره موبایل یا رمز عبور اشتباه است");
    } finally {
      setLoading(false);
    }
  };

  const handleResendLoginCode = async () => {
    const normalizedPhone = normalizeIranPhone(phone);
    if (!normalizedPhone) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ phone: normalizedPhone, purpose: "LOGIN" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "ارسال کد انجام نشد");
      setNotice(data.message || "کد تأیید دوباره ارسال شد.");
    } catch (err) {
      setError(err?.message || "ارسال کد انجام نشد");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[var(--background-app)] px-4 py-6"
      dir="rtl"
    >
      <div className="fixed left-4 top-4 z-50 sm:left-5 sm:top-5">
        <ThemeToggle />
      </div>

      <div className="card w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex justify-center">
          <img
            src="/images/logo.png"
            className="h-16 w-16 rounded-2xl object-cover"
            alt="لوگو برجک"
          />
        </div>

        <h1 className="mb-6 text-center text-2xl font-black text-[var(--color-primary)] dark:text-white">
          ورود
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Phone */}
          <input
            type="tel"
            inputMode="tel"
            placeholder="شماره موبایل"
            value={phone}
            disabled={requiresLoginVerification}
            onChange={(e) => {
              const value = normalizeDigits(e.target.value)
                .replace(/[^\d+]/g, "")
                .slice(0, 13);

              setPhone(value);
              if (requiresCaptcha) {
                setCaptchaToken("");
                setCaptchaWidgetKey((current) => current + 1);
              }
            }}
            autoComplete="tel"
            dir="ltr"
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />

          {/* Password */}
          {!requiresLoginVerification && <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="رمز عبور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="rtl"
              className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] py-0 pr-4 pl-12 text-sm text-[var(--color-text)] transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] transition hover:text-[var(--color-primary)]"
              aria-label={
                showPassword
                  ? "مخفی کردن رمز عبور"
                  : "نمایش رمز عبور"
              }
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                  <path d="M16.68 16.67A10.94 10.94 0 0 1 12 18c-6.5 0-10-6-10-6a21.77 21.77 0 0 1 5.1-5.94" />
                  <path d="M19.73 14.27A21.7 21.7 0 0 0 22 12s-3.5-6-10-6a10.94 10.94 0 0 0-4.24.85" />
                  <path d="M2 2l20 20" />
                </svg>
              )}
            </button>
          </div>}

          {requiresLoginVerification && (
            <>
              <p className="text-center text-sm text-[var(--color-text-muted)]">
                برای تکمیل ورود، کد پیامکی ارسال‌شده به شماره ثبت‌شده را وارد کنید.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="کد تأیید شش‌رقمی"
                value={otpCode}
                onChange={(e) => setOtpCode(normalizeDigits(e.target.value).replace(/\D/g, "").slice(0, 6))}
                dir="ltr"
                className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-center text-lg tracking-[0.35em] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              />
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={handleResendLoginCode} disabled={loading} className="font-bold text-[var(--color-accent)] disabled:opacity-50">
                  ارسال مجدد کد
                </button>
                <button type="button" onClick={() => { setRequiresLoginVerification(false); setOtpCode(""); setError(""); }} className="text-[var(--color-text-muted)]">
                  بازگشت
                </button>
              </div>
            </>
          )}

          {requiresCaptcha && !requiresLoginVerification && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
              <p className="mb-3 text-center text-sm text-[var(--color-text-muted)]">
                برای ادامه ورود، لطفاً بررسی امنیتی را تکمیل کنید.
              </p>
              {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
                <TurnstileCaptcha
                  key={captchaWidgetKey}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  onToken={setCaptchaToken}
                  onError={() => setError("بارگذاری تأیید امنیتی ناموفق بود. اتصال اینترنت را بررسی و صفحه را تازه‌سازی کنید.")}
                />
              ) : (
                <p className="text-center text-sm text-red-500">
                  سرویس تأیید امنیتی روی سایت تنظیم نشده است. لطفاً با پشتیبانی تماس بگیرید.
                </p>
              )}
            </div>
          )}

          {notice && (
            <p className="text-center text-sm text-[var(--color-accent)]">
              {notice}
            </p>
          )}
          {error && (
            <p className="text-center text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (requiresCaptcha && !requiresLoginVerification && !captchaToken)}
            className="btn-primary h-12 w-full rounded-2xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "لطفاً صبر کنید..." : requiresLoginVerification ? "تأیید کد و ورود" : "ورود"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[var(--color-text-muted)]">
          حساب کاربری ندارید؟{" "}
          <Link
            href={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-[var(--color-text)] transition hover:text-[var(--color-accent)]"
          >
            ثبت‌نام
          </Link>
        </p>

        <p className="mt-4 text-center text-sm text-[var(--color-text-muted)]">
          <Link
            href="/forgot-password"
            className="font-bold text-[var(--color-text-muted)] transition hover:text-[var(--color-accent)]"
          >
            رمز عبور را فراموش کرده‌اید؟
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
