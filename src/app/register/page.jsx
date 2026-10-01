"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function RegisterContent() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = searchParams.get("redirect") || "/";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !phone.trim() || !password) {
      setError("همه فیلدها الزامی هستند");
      return;
    }

    setLoading(true);

    try {
      const data = await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
      });

      if (!data.isPhoneVerified) {
        router.push(
          `/verify-phone?redirect=${encodeURIComponent(redirect)}`
        );
        return;
      }

      router.push(redirect);
    } catch (err) {
      setError(err?.message || "خطا در ثبت‌نام");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[var(--background-app)] px-4 py-6"
      dir="rtl"
    >
      {/* Theme - top left of page */}
      <div className="fixed left-4 top-4 z-50 sm:left-5 sm:top-5">
        <ThemeToggle />
      </div>

      {/* Register Card */}
      <div className="card w-full max-w-md p-6 sm:p-8">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <img
            src="/images/logo.png"
            className="h-16 w-16 rounded-2xl object-cover"
            alt="لوگو برجک"
          />
        </div>

        {/* Title */}
        <h1 className="mb-6 text-center text-2xl font-black text-[var(--color-primary)] dark:text-white">
          ثبت‌نام
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <input
            type="text"
            placeholder="نام و نام خانوادگی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            dir="rtl"
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />

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
            className="h-12 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 text-sm text-[var(--color-text)] transition placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none"
          />

          {/* Password */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="رمز عبور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
          </div>

          {/* Error */}
          {error && (
            <p className="text-center text-sm text-red-500">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary h-12 w-full rounded-2xl text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
          </button>
        </form>

        {/* Login */}
        <p className="mt-5 text-center text-sm text-[var(--color-text-muted)]">
          قبلاً ثبت‌نام کردی؟{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(redirect)}`}
            className="font-bold text-[var(--color-text)] transition hover:text-[var(--color-accent)]"
          >
            ورود
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
