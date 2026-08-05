"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/auth/me", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data))
      .catch((err) => {
        if (err.name !== "AbortError") {
          setUser(null);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const login = async (phone, password) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "خطا در ورود");
    }

    await refreshUser();
    return data;
  };

  const register = async ({ name, phone, password }) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "خطا در ثبت‌نام");
    }

    return login(phone, password);
  };

  const logout = async () => {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
    });

    if (res.ok) {
      setUser(null);
      router.push("/login");
    }
  };

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setUser(null);
        return null;
      }
      const data = await res.json();
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
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