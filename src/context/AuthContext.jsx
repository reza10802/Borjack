"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  // ─────────────────────────────────────────────
  // Load current session
  // ─────────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController();

    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });

        if (!res.ok) {
          if (!controller.signal.aborted) {
            setUser(null);
          }
          return;
        }

        const data = await res.json();

        if (!controller.signal.aborted) {
          setUser(data);
        }
      } catch (err) {
        if (
          err.name !== "AbortError" &&
          !controller.signal.aborted
        ) {
          console.error("AUTH INIT ERROR:", err);
          setUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadSession();

    return () => controller.abort();
  }, []);

  // ─────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────

  const login = async (phone, password, captchaToken = "") => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        phone,
        password,
        ...(captchaToken ? { captchaToken } : {}),
      }),
    });

    const data = await res.json();

    // Login failed
    if (!res.ok) {
      const error = new Error(data?.error || "خطا در ورود");
      error.requiresCaptcha = data?.requiresCaptcha === true;
      error.captchaUnavailable = res.status === 503;
      error.status = res.status;
      throw error;
    }

    // Suspicious-login step-up: no full session exists yet; the login page must collect OTP.
    if (data?.requiresLoginVerification) {
      return data;
    }

    // شماره هنوز تأیید نشده
    if (!data?.isPhoneVerified) {
      setUser(null);
      return data;
    }

    // Login موفق
    // حداقل اطلاعات کاربر را بلافاصله داخل state قرار بده
    setUser(data);

    // اطلاعات کامل session را از سرور بگیر
    const refreshedUser = await refreshUser();

    if (refreshedUser) {
      setUser(refreshedUser);
      return refreshedUser;
    }

    // حتی اگر refresh شکست خورد،
    // login موفق را از بین نمی‌بریم
    return data;
  };

  // ─────────────────────────────────────────────
  // Register
  // ─────────────────────────────────────────────

  const register = async ({ name, phone, password }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        name,
        phone,
        password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || "خطا در ثبت‌نام");
    }

    // بعد از ثبت‌نام، login وضعیت تأیید شماره را تعیین می‌کند.
    // اگر IP به CAPTCHA رسیده باشد، حساب ساخته شده؛ کاربر را به صفحه ورود می‌فرستیم
    // تا CAPTCHA را تکمیل کند و سپس تأیید شماره را ادامه دهد.
    try {
      return await login(phone, password);
    } catch (error) {
      if (error?.requiresCaptcha) return { requiresLoginCaptcha: true };
      throw error;
    }
  };

  // ─────────────────────────────────────────────
  // Refresh session
  // ─────────────────────────────────────────────

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();

      setUser(data);

      return data;
    } catch (error) {
      console.error("REFRESH USER ERROR:", error);

      return null;
    }
  };

  // ─────────────────────────────────────────────
  // Logout
  // ─────────────────────────────────────────────

  const logout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setUser(null);
        router.push("/login");
      }
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}