"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import {XIcon } from "lucide-react";

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
    <div
      dir="rtl"
      className=" min-h-screen flex flex-col bg-[var(--background-app)] text-[var(--color-primary)] transition-colors duration-300 "
    >
      {/* Header */}
      <header className="sticky top-0 z-40 h-16 card rounded-none border-t-0 border-l-0 border-r-0">
        <div className="h-full px-3 sm:px-6 flex items-center justify-between gap-3">
          {/* right */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center text justify-center w-9 h-9 rounded-lg border border-[var(--color-border)] dark:text-white  hover:bg-[var(--background-app-rgb)] transition"
              aria-label="باز کردن منو"
            >
              ☰
            </button>

            <Link
              href="/"
              className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition"
            >
              بازگشت به سایت
            </Link>

            <span className="hidden sm:inline text-gray-300">|</span>

            <span className="font-semibold text-sm sm:text-base text-[var(--color-primary)] dark:text-white">
              پنل مدیریت
            </span>
          </div>

          {/* left */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <ThemeToggle />

            <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-300">
              {user.name}
            </span>

            <span
              className="px-2.5 sm:px-4 py-1.5 text-xs sm:text-sm rounded-xl font-medium whitespace-nowrap bg-[var(--color-primary)] dark:bg-zinc-900 text-white"
            >
              {user.role === "ADMIN" ? "ادمین" : "منیجر"}
            </span>

            <button
              onClick={logout}
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-xl dark:bg-zinc-900 bg-[var(--color-primary)] text-white hover:bg-gray-800 transition"
            >
              خروج
            </button>

          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar */}
        <aside
          className=" hidden lg:flex w-64 shrink-0 card rounded-none border-t-0 border-b-0 border-r-0 "
        >
          <nav className="flex-1 flex flex-col gap-2 p-4 overflow-y-auto">
            {visibleNav.map((item) => {
              const isDashboard = item.href === "/admin";
              const isActive = isDashboard
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${isActive
                    ? "btn-primary"
                    : "hover:bg-[var(--background-app)] text-[var(--color-text)]"
                    }`}
                >
                  <span className="text-base">{item.icon}</span>
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
          className={`lg:hidden fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] card rounded-none border-t-0 border-b-0 border-r-0 transition-all duration-300 ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"} `}
        >
          <div className="h-14 px-4 flex items-center justify-between">
            <span className="font-semibold text-[var(--color-primary)] dark:text-white">منوی مدیریت</span>
            <button
              onClick={() => setMobileMenuOpen(false)}
            >
              <XIcon className="dark:text-white cursor-pointer" />
            </button>
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
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition ${isActive
                    ? "btn-primary"
                    : "hover:bg-[var(--background-app)] text-[var(--color-text)]"
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
        <main
          className=" flex-1 p-3 sm:p-5 lg:p-6 bg-[var(--background-app)] transition-colors duration-300"
        >
          {children}
        </main>
      </div>
    </div>
  );
}