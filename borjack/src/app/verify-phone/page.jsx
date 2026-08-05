"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const RESEND_COOLDOWN = 60;

function VerifyPhoneContent() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = searchParams.get("redirect") || "/";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const hasSentOnce = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.isPhoneVerified) {
      router.replace(redirect);
    }
  }, [authLoading, user, redirect, router]);

  const sendCode = async () => {
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "خطا در ارسال کد");
      }

      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user || user.isPhoneVerified) return;
    if (hasSentOnce.current) return;

    hasSentOnce.current = true;
    sendCode();
  }, [authLoading, user]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    if (code.trim().length !== 6) {
      setError("کد تایید باید ۶ رقم باشد");
      return;
    }

    setVerifying(true);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: user.phone, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "کد تایید اشتباه است");
      }

      await refreshUser();
      router.push(redirect);
    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  if (authLoading || !user) {
    return null;
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
          کد تایید به شماره {user.phone} ارسال شد
        </p>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            placeholder="کد ۶ رقمی"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            dir="ltr"
            className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 text-center text-lg tracking-widest text-zinc-800 dark:text-zinc-100 transition"
          />

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={verifying}
            className="btn-primary w-full h-12 rounded-2xl text-sm font-bold disabled:opacity-50"
          >
            {verifying ? "در حال بررسی..." : "تایید کد"}
          </button>
        </form>

        <div className="text-center mt-5">
          <button
            type="button"
            onClick={sendCode}
            disabled={sending || cooldown > 0}
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