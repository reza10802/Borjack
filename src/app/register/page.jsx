"use client";

import { useState,Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

    if (!name || !phone || !password) {
      setError("همه فیلدها الزامی هستند");
      return;
    }

    setLoading(true);

    try {
      await register({ name, phone, password });
      router.push(redirect);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50"
      dir="rtl"
    >
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img
            src="/images/photo_2026-06-20_01-20-44.jpg"
            className="w-12 h-12 rounded-xl object-cover"
            alt="لوگو"
          />
        </div>

        <h1 className="text-xl font-bold text-center mb-6">ثبت‌نام</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="نام و نام خانوادگی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            dir="rtl"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-right focus:outline-none focus:border-blue-500"
          />

          <input
            type="text"
            placeholder="شماره موبایل"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            dir="rtl"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-right focus:outline-none focus:border-blue-500"
          />

          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="رمز عبور"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              dir="rtl"
              className="w-full h-12 border border-gray-300 rounded-lg pr-4 pl-12 text-sm text-right focus:outline-none focus:border-blue-500"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? "مخفی کردن رمز عبور" : "نمایش رمز عبور"}
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

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          قبلاً ثبت‌نام کردی؟{" "}
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`} className="text-black font-medium hover:underline">
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