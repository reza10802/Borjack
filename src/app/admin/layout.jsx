"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { XIcon, Store } from "lucide-react";

const navItems = [
  {
    label: "داشبورد",
    href: "/admin",
    icon: "⬛",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "کالاها",
    href: "/admin/products",
    icon: "📦",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "سفارشات",
    href: "/admin/orders",
    icon: "🛒",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "نظرات",
    href: "/admin/reviews",
    icon: "💬",
    roles: ["ADMIN", "MANAGER"],
  },
  {
    label: "دسته‌بندی‌ها",
    href: "/admin/categories",
    icon: "◈",
    roles: ["ADMIN"],
  },
  {
    label: "کاربران",
    href: "/admin/users",
    icon: "👥",
    roles: ["ADMIN"],
  },
  {
    label: "کارکنان",
    href: "/admin/staff",
    icon: "🧑‍💼",
    roles: ["ADMIN"],
  },
  {
    label: "لاگ‌ها",
    href: "/admin/logs",
    icon: "📋",
    roles: ["ADMIN"],
  },
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
        (page) =>
          pathname === page || pathname.startsWith(page + "/")
      );

      if (!allowed) {
        router.replace("/403");
      }
    }
  }, [user, loading, pathname, router]);

  // بستن منوی موبایل هنگام تغییر صفحه
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // بستن منو با Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  if (loading || !user) return null;

  const visibleNav = navItems.filter((item) =>
    item.roles.includes(user.role)
  );

  const isActiveRoute = (href) => {
    if (href === "/admin") {
      return pathname === "/admin";
    }

    return (
      pathname === href ||
      pathname.startsWith(href + "/")
    );
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[var(--background-app)] text-[var(--color-text)] transition-colors duration-300"
    >
      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-40 h-16 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-full w-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">

          {/* Right side */}
          <div className="flex min-w-0 items-center gap-2">

            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="باز کردن منو"
              aria-expanded={mobileMenuOpen}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border)] text-lg text-[var(--color-text)] transition hover:bg-[var(--background-app)] lg:hidden"
            >
              ☰
            </button>

            {/* Back to store */}
            <Link
              href="/"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:bg-[var(--background-app)] hover:text-[var(--color-accent)] sm:px-4 sm:text-sm"
              aria-label="برگشت به فروشگاه"
            >
              <Store size={16} />
              <span>برگشت به فروشگاه</span>
            </Link>

            <span className="hidden text-zinc-300 sm:inline">
              |
            </span>

            {/* Panel title */}
            <span className="truncate text-sm font-semibold text-[var(--color-text)] sm:text-base">
              پنل مدیریت
            </span>
          </div>

          {/* Left side */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">

            {/* Theme */}
            <div className="flex h-9 w-9 items-center justify-center [&>button]:!h-9 [&>button]:!w-9 [&>button]:!rounded-xl">
              <ThemeToggle />
            </div>

            {/* User name */}
            <span className="hidden max-w-[140px] truncate text-sm text-zinc-500 lg:inline dark:text-zinc-300">
              {user.name}
            </span>

            {/* Role */}
            <span className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-xs font-medium whitespace-nowrap text-white sm:px-4 sm:text-sm dark:bg-zinc-900">
              {user.role === "ADMIN" ? "ادمین" : "منیجر"}
            </span>

            {/* Logout */}
            <button
              type="button"
              onClick={logout}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-xs font-medium whitespace-nowrap text-white transition hover:opacity-90 sm:px-4 sm:text-sm dark:bg-zinc-900"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      {/* ==================== BODY ==================== */}
      <div className="flex min-h-[calc(100vh-4rem)] min-w-0">

        {/* Desktop Sidebar */}
        <aside className="hidden w-60 shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
          <nav className="sticky top-16 flex h-[calc(100vh-4rem)] w-full flex-col gap-1.5 overflow-y-auto p-3">
            {visibleNav.map((item) => {
              const isActive = isActiveRoute(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                      ? "btn-primary"
                      : "text-[var(--color-text)] hover:bg-[var(--background-app)]"
                    }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                    {item.icon}
                  </span>

                  <span className="truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Drawer */}
        <aside
          className={`fixed inset-y-0 right-0 z-[60] flex w-72 max-w-[85vw] flex-col bg-[var(--color-surface)] shadow-2xl transition-transform duration-300 lg:hidden ${mobileMenuOpen
              ? "translate-x-0"
              : "translate-x-full"
            }`}
          aria-label="منوی مدیریت"
        >
          {/* Drawer header */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
            <span className="font-semibold text-[var(--color-text)]">
              منوی مدیریت
            </span>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="بستن منو"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text)] transition hover:bg-[var(--background-app)]"
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* Drawer nav */}
          <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
            {visibleNav.map((item) => {
              const isActive = isActiveRoute(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${isActive
                      ? "btn-primary"
                      : "text-[var(--color-text)] hover:bg-[var(--background-app)]"
                    }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-base">
                    {item.icon}
                  </span>

                  <span className="truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Store button inside mobile menu */}
          <div className="border-t border-[var(--color-border)] p-3">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              <Store size={17} />
              <span>برگشت به فروشگاه</span>
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 overflow-x-hidden bg-[var(--background-app)] p-3 transition-colors duration-300 sm:p-5 lg:p-6">
          <div className="min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
