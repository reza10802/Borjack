"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function normalizeDigits(value) {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (char) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(char))
    )
    .replace(/[٠-٩]/g, (char) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(char))
    );
}

function normalizeIranPhone(value) {
  let phone = normalizeDigits(value).trim();

  phone = phone.replace(/[\s()-]/g, "");
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

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawPhone = searchParams.get("phone") || "";
  const phone = normalizeIranPhone(rawPhone);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpControllerRef = useRef(null);

  // ─────────────────────────────────────────────
  // Reset password
  // ─────────────────────────────────────────────

  const resetPassword = useCallback(
    async (value) => {
      const cleanCode = normalizeDigits(value)
        .replace(/\D/g, "")
        .slice(0, 6);

      if (cleanCode.length !== 6) {
        return;
      }

      if (!phone) {
        setError("شماره موبایل نامعتبر است");
        return;
      }

      if (loading) {
        return;
      }

      if (password.length < 6) {
        setError(
          "رمز عبور باید حداقل ۶ کاراکتر باشد"
        );
        return;
      }

      if (password !== passwordRepeat) {
        setError("تکرار رمز عبور صحیح نیست");
        return;
      }

      setError("");
      setLoading(true);

      try {
        const res = await fetch(
          "/api/auth/reset-password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              phone,
              code: cleanCode,
              password,
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error ||
              "خطا در تغییر رمز عبور"
          );
        }

        router.replace("/login?reset=success");
      } catch (err) {
        setError(
          err?.message ||
            "خطا در تغییر رمز عبور"
        );
      } finally {
        setLoading(false);
      }
    },
    [
      phone,
      password,
      passwordRepeat,
      loading,
      router,
    ]
  );

  // ─────────────────────────────────────────────
  // Manual submit
  // ─────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanCode = normalizeDigits(code)
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("کد تایید باید ۶ رقم باشد");
      return;
    }

    await resetPassword(cleanCode);
  };

  // ─────────────────────────────────────────────
  // WebOTP
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!phone) {
      return;
    }

    const supportsWebOTP =
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      "OTPCredential" in window &&
      "credentials" in navigator &&
      window.isSecureContext;

    if (!supportsWebOTP) {
      return;
    }

    const controller = new AbortController();
    otpControllerRef.current = controller;

    const startWebOTP = async () => {
      try {
        const credential =
          await navigator.credentials.get({
            otp: {
              transport: ["sms"],
            },
            signal: controller.signal,
          });

        if (!credential?.code) {
          return;
        }

        const receivedCode =
          normalizeDigits(credential.code)
            .replace(/\D/g, "")
            .slice(0, 6);

        if (receivedCode.length !== 6) {
          return;
        }

        setCode(receivedCode);
        setError("");

        await resetPassword(receivedCode);
      } catch (err) {
        if (err?.name !== "AbortError") {
          console.log(
            "WebOTP unavailable:",
            err
          );
        }
      }
    };

    startWebOTP();

    return () => {
      controller.abort();
      otpControllerRef.current = null;
    };
  }, [phone, resetPassword]);

  // ─────────────────────────────────────────────
  // No phone
  // ─────────────────────────────────────────────

  if (!phone) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        dir="rtl"
      >
        <p className="text-sm text-red-500">
          شماره موبایل نامعتبر است.
        </p>
      </div>
    );
  }

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
          تغییر رمز عبور
        </h1>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          کد ارسال‌شده به شماره{" "}
          <span dir="ltr">{phone}</span>{" "}
          را وارد کنید.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
        >
          {/* OTP */}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="کد ۶ رقمی"
            value={code}
            onChange={(e) => {
              const value = normalizeDigits(
                e.target.value
              )
                .replace(/\D/g, "")
                .slice(0, 6);

              setCode(value);
              setError("");

              // بعد از ورود رقم ششم، خودکار بررسی شود
              if (
                value.length === 6 &&
                !loading
              ) {
                resetPassword(value);
              }
            }}
            dir="ltr"
            disabled={loading}
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-lg tracking-widest text-zinc-800 dark:text-zinc-100 transition disabled:opacity-60"
          />

          {/* Password */}
          <input
            type="password"
            placeholder="رمز عبور جدید"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoComplete="new-password"
            dir="rtl"
            disabled={loading}
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
          />

          {/* Password repeat */}
          <input
            type="password"
            placeholder="تکرار رمز عبور جدید"
            value={passwordRepeat}
            onChange={(e) => {
              setPasswordRepeat(e.target.value);
              setError("");
            }}
            autoComplete="new-password"
            dir="rtl"
            disabled={loading}
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          {/* Fallback button */}
          <button
            type="submit"
            disabled={
              loading ||
              code.length !== 6
            }
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {loading
              ? "در حال تغییر رمز..."
              : "تغییر رمز عبور"}
          </button>
        </form>
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