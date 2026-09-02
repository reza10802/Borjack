"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function getSafeRedirect(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  // جلوگیری از redirect loop
  if (value.startsWith("/login") || value.startsWith("/verify-phone")) {
    return "/";
  }

  return value;
}

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = getSafeRedirect(searchParams.get("redirect"));

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.trim();

    if (!cleanPhone) {
      setError("شماره موبایل را وارد کنید");
      return;
    }

    if (!/^09\d{9}$/.test(cleanPhone)) {
      setError("شماره موبایل معتبر نیست");
      return;
    }

    if (!password) {
      setError("رمز عبور را وارد کنید");
      return;
    }

    setLoading(true);

    try {
      const data = await login(cleanPhone, password);

      // کاربر لاگین شده ولی شماره‌اش هنوز تأیید نشده
      if (!data.isPhoneVerified) {
        router.replace(
          `/verify-phone?redirect=${encodeURIComponent(redirect)}`
        );
        return;
      }

      // ورود کامل
      router.replace(redirect);
    } catch (err) {
      setError(
        err?.message || "شماره موبایل یا رمز عبور اشتباه است"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[var(--background-app)] flex items-center justify-center px-4"
      dir="rtl"
    >
      <div className="card relative w-full max-w-md p-8">
        {/* Theme */}
        <div className="absolute top-5 left-5">
          <ThemeToggle />
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src="/images/logo.png"
            className="w-16 h-16 rounded-2xl object-cover"
            alt="لوگو برجک"
          />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-black text-center mb-6 text-[var(--color-primary)] dark:text-white">
          ورود
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Phone */}
          <input
            type="tel"
            inputMode="numeric"
            placeholder="شماره موبایل"
            value={phone}
            onChange={(e) =>
              setPhone(
                e.target.value.replace(/\D/g, "").slice(0, 11)
              )
            }
            autoComplete="tel"
            dir="ltr"
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-sm text-zinc-800 dark:text-zinc-100 transition"
          />

          {/* Password */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="رمز عبور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="rtl"
              className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 pr-4 pl-12 text-sm text-zinc-800 dark:text-zinc-100 transition"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-[var(--color-primary)] transition"
              aria-label={
                showPassword
                  ? "مخفی کردن رمز عبور"
                  : "نمایش رمز عبور"
              }
            >
              {showPassword ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-5 h-5"
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
                  className="w-5 h-5"
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
          </div>

          {/* Error */}
          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {loading ? "در حال ورود..." : "ورود"}
          </button>
        </form>

        {/* Register */}
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-5">
          حساب کاربری ندارید؟{" "}
          <Link
            href={`/register?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-zinc-700 dark:text-zinc-300 hover:text-[var(--color-accent)] transition"
          >
            ثبت‌نام
          </Link>
        </p>
        {/* Forgot password */}
        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mt-5">
          <Link
            href="/forgot-password"
            className="text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition"
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