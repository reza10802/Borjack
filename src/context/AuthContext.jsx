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

    fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          return null;
        }

        return res.json();
      })
      .then((data) => {
        setUser(data);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("AUTH INIT ERROR:", err);
          setUser(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  // ─────────────────────────────────────────────
  // Login
  // ─────────────────────────────────────────────

  const login = async (phone, password) => {
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
      }),
    });

    const data = await res.json();

    // Login failed
    if (!res.ok) {
      throw new Error(data?.error || "خطا در ورود");
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

    // بعد از ثبت‌نام، login وضعیت تأیید شماره را تعیین می‌کند
    return login(phone, password);
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