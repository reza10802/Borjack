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

const RESEND_COOLDOWN = 120;
const WEB_OTP_TIMEOUT = 5 * 60 * 1000;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function getSafeRedirect(value) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }

  if (
    value.startsWith("/login") ||
    value.startsWith("/register") ||
    value.startsWith("/verify-phone")
  ) {
    return "/";
  }

  return value;
}

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

// ─────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────

function VerifyPhoneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = getSafeRedirect(
    searchParams.get("redirect")
  );

  const phone = normalizeIranPhone(
    searchParams.get("phone") || ""
  );

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const hasSentOnce = useRef(false);
  const verifyAbortRef = useRef(null);

  // ─────────────────────────────────────────────
  // Verify OTP
  // ─────────────────────────────────────────────

  const verifyCode = useCallback(
    async (value) => {
      const cleanCode = normalizeDigits(value)
        .replace(/\D/g, "")
        .slice(0, 6);

      if (cleanCode.length !== 6) {
        return;
      }

      if (!phone) {
        setError(
          "شماره موبایل پیدا نشد. دوباره وارد شوید."
        );
        return;
      }

      if (verifying) {
        return;
      }

      // جلوگیری از درخواست همزمان
      if (verifyAbortRef.current) {
        verifyAbortRef.current.abort();
      }

      const controller = new AbortController();
      verifyAbortRef.current = controller;

      setError("");
      setVerifying(true);

      try {
        const res = await fetch(
          "/api/auth/verify-otp",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            signal: controller.signal,
            body: JSON.stringify({
              phone,
              code: cleanCode,
              purpose: "VERIFY_PHONE",
            }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error ||
              "کد تایید اشتباه است"
          );
        }

        setCode(cleanCode);

        // API در این مرحله JWT اصلی را ساخته.
        // فقط session سمت کلاینت را تازه می‌کنیم.
        router.replace(redirect);
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }

        setError(
          err?.message ||
            "خطا در بررسی کد تایید"
        );
      } finally {
        if (
          verifyAbortRef.current === controller
        ) {
          verifyAbortRef.current = null;
        }

        setVerifying(false);
      }
    },
    [phone, redirect, router, verifying]
  );

  // ─────────────────────────────────────────────
  // Send OTP
  // ─────────────────────────────────────────────

  const sendCode = useCallback(async () => {
    if (!phone) {
      setError(
        "شماره موبایل پیدا نشد. دوباره وارد شوید."
      );
      return false;
    }

    if (sending || cooldown > 0) {
      return false;
    }

    setError("");
    setSending(true);

    try {
      const res = await fetch(
        "/api/auth/send-otp",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
            body: JSON.stringify({
            phone,
            purpose: "VERIFY_PHONE",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ||
            "خطا در ارسال کد تایید"
        );
      }

      setCooldown(RESEND_COOLDOWN);

      return true;
    } catch (err) {
      setError(
        err?.message ||
          "خطا در ارسال کد تایید"
      );

      return false;
    } finally {
      setSending(false);
    }
  }, [phone, sending, cooldown]);

  // ─────────────────────────────────────────────
  // WebOTP + automatic first OTP
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (!phone || hasSentOnce.current) {
      return;
    }

    hasSentOnce.current = true;

    let otpController = null;
    let timeoutId = null;

    const startWebOTP = async () => {
      const supportsWebOTP =
        typeof window !== "undefined" &&
        typeof navigator !== "undefined" &&
        "OTPCredential" in window &&
        "credentials" in navigator;

      if (!supportsWebOTP) {
        return;
      }

      if (!window.isSecureContext) {
        return;
      }

      otpController = new AbortController();

      timeoutId = setTimeout(() => {
        otpController?.abort();
      }, WEB_OTP_TIMEOUT);

      try {
        // مهم:
        // listener قبل از ارسال SMS فعال می‌شود.
        const credential =
          await navigator.credentials.get({
            otp: {
              transport: ["sms"],
            },
            signal: otpController.signal,
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

        // تأیید خودکار
        await verifyCode(receivedCode);
      } catch (err) {
        if (
          err?.name !== "AbortError"
        ) {
          console.log(
            "WebOTP unavailable:",
            err
          );
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    // ابتدا WebOTP را آماده کن،
    // سپس SMS را ارسال کن.
    startWebOTP();

    sendCode();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      otpController?.abort();
    };
  }, [phone, sendCode, verifyCode]);

  // ─────────────────────────────────────────────
  // Cooldown
  // ─────────────────────────────────────────────

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  // ─────────────────────────────────────────────
  // Cleanup verify request
  // ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      verifyAbortRef.current?.abort();
    };
  }, []);

  // ─────────────────────────────────────────────
  // Manual submit fallback
  // ─────────────────────────────────────────────

  const handleVerify = async (e) => {
    e.preventDefault();

    await verifyCode(code);
  };

  // ─────────────────────────────────────────────
  // No phone
  // ─────────────────────────────────────────────

  if (!phone) {
    return (
      <div
        className="min-h-screen bg-[var(--background-app)] flex items-center justify-center px-4"
        dir="rtl"
      >
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-red-500 text-sm mb-5">
            جلسه تایید شماره پیدا نشد.
          </p>

          <button
            type="button"
            onClick={() =>
              router.replace("/login")
            }
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold"
          >
            بازگشت به ورود
          </button>
        </div>
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
          تایید شماره موبایل
        </h1>

        <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          کد تایید به شماره{" "}
          <span dir="ltr">{phone}</span>{" "}
          ارسال شد.
        </p>

        <form
          onSubmit={handleVerify}
          className="flex flex-col gap-4"
        >
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

              // با ورود رقم ششم، خودکار verify
              if (
                value.length === 6 &&
                !verifying
              ) {
                verifyCode(value);
              }
            }}
            dir="ltr"
            disabled={verifying}
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-lg tracking-widest text-zinc-800 dark:text-zinc-100 transition disabled:opacity-60"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              verifying ||
              code.length !== 6
            }
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {verifying
              ? "در حال بررسی..."
              : "تایید کد"}
          </button>
        </form>

        <div className="text-center mt-5">
          <button
            type="button"
            onClick={sendCode}
            disabled={
              sending || cooldown > 0
            }
            className="text-sm font-bold text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition disabled:opacity-50"
          >
            {cooldown > 0
              ? `ارسال دوباره کد (${cooldown} ثانیه)`
              : sending
                ? "در حال ارسال..."
                : "ارسال دوباره کد"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPhonePage() {
  return (
    <Suspense fallback={null}>
      <VerifyPhoneContent />
    </Suspense>
  );
}