"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

const navItems = [
  { label: "داشبورد", href: "/admin", icon: "⬛", roles: ["ADMIN", "MANAGER"] },
  { label: "کالاها", href: "/admin/products", icon: "📦", roles: ["ADMIN", "MANAGER"] },
  { label: "سفارشات", href: "/admin/orders", icon: "🛒", roles: ["ADMIN", "MANAGER"] },
  { label: "نظرات", href: "/admin/reviews", icon: "💬", roles: ["ADMIN", "MANAGER"] },

  { label: "دسته‌بندی‌ها", href: "/admin/categories", icon: "◈", roles: ["ADMIN"] },
  { label: "کاربران", href: "/admin/users", icon: "👥", roles: ["ADMIN"] },
  { label: "کارکنان", href: "/admin/staff", icon: "🧑‍💼", roles: ["ADMIN"] },
  { label: "لاگ‌ها", href: "/admin/logs", icon: "📋", roles: ["ADMIN"] },
];

const managerAllowedPages = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/reviews",
];

export default function AdminLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!["ADMIN", "MANAGER"].includes(user.role)) {
      router.replace("/403");
      return;
    }

    if (user.role === "MANAGER") {
      const allowed = managerAllowedPages.some(
        (page) => pathname === page || pathname.startsWith(page + "/")
      );

      if (!allowed) {
        router.replace("/403");
      }
    }
  }, [user, loading, pathname, router]);

  // با عوض شدن صفحه، منوی موبایل بسته شود
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading || !user) return null;

  const visibleNav = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 bg-white border-b border-gray-200">
        <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-3">
          {/* right */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              aria-label="باز کردن منو"
            >
              ☰
            </button>

            <Link
              href="/"
              className="text-xs sm:text-sm text-gray-500 hover:text-black transition whitespace-nowrap"
            >
              بازگشت به سایت
            </Link>

            <span className="hidden sm:inline text-gray-300">|</span>

            <span className="font-semibold text-sm sm:text-base text-gray-800 whitespace-nowrap">
              پنل مدیریت
            </span>
          </div>

          {/* left */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="hidden sm:inline text-sm text-gray-600 truncate max-w-[120px]">
              {user.name}
            </span>

            <span
              className={`px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm rounded-xl font-medium whitespace-nowrap ${
                user.role === "ADMIN"
                  ? "bg-black text-white"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {user.role === "ADMIN" ? "ادمین" : "منیجر"}
            </span>

            <button
              onClick={logout}
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-60 shrink-0 bg-white border-l border-gray-200 flex-col py-4 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1 px-3">
            {visibleNav.map((item) => {
              const isDashboard = item.href === "/admin";
              const isActive = isDashboard
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                    isActive
                      ? "bg-black text-white font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Drawer Overlay */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Drawer */}
        <aside
          className={`lg:hidden fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-white border-l border-gray-200 transition-transform duration-300 ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-gray-800">منوی مدیریت</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              ✕
            </button>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-800">{user.name}</div>
            <div className="mt-2">
              <span
                className={`inline-flex px-3 py-1 rounded-xl text-xs font-medium ${
                  user.role === "ADMIN"
                    ? "bg-black text-white"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {user.role === "ADMIN" ? "ادمین" : "منیجر"}
              </span>
            </div>
          </div>

          <nav className="flex flex-col gap-1 p-3">
            {visibleNav.map((item) => {
              const isDashboard = item.href === "/admin";
              const isActive = isDashboard
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition ${
                    isActive
                      ? "bg-black text-white font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}