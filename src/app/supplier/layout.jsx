
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Store } from "lucide-react";

const navItems = [
  { label: "داشبورد", href: "/supplier", icon: "⬛" },
  { label: "کالاهای من", href: "/supplier/products", icon: "📦" },
  { label: "وظایف من", href: "/supplier/tasks", icon: "📋" },
  { label: "سفارش‌های من", href: "/supplier/orders", icon: "🧾" },
];

// Independent of the admin panel.
// Every supplier API must verify the user's role, active status and token version.
export default function SupplierLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "SUPPLIER") {
      router.replace("/403");
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== "SUPPLIER") {
    return null;
  }

  const isActiveRoute = (href) =>
    href === "/supplier"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[var(--background-app)] text-[var(--color-text)] transition-colors duration-300"
    >
      <header className="sticky top-0 z-40 h-16 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex h-full w-full items-center justify-between gap-3 px-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs font-medium text-[var(--color-text)] transition hover:bg-[var(--background-app)]"
              aria-label="برگشت به فروشگاه"
            >
              <Store size={16} />
              <span>برگشت به فروشگاه</span>
            </Link>

            <span className="hidden text-zinc-300 sm:inline">
              |
            </span>

            <span className="hidden truncate text-sm font-semibold sm:inline sm:text-base">
              پنل فروشگاه
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex h-9 w-9 items-center justify-center [&>button]:!h-9 [&>button]:!w-9 [&>button]:!rounded-xl">
              <ThemeToggle />
            </div>

            <span className="hidden max-w-[140px] truncate text-sm text-zinc-500 lg:inline dark:text-zinc-300">
              {user.name}
            </span>

            <span className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-xs font-medium whitespace-nowrap text-white sm:px-4 sm:text-sm dark:bg-zinc-900">
              تأمین‌کننده
            </span>

            <button
              type="button"
              onClick={logout}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--color-primary)] px-3 text-xs font-medium whitespace-nowrap text-white transition hover:opacity-90 sm:px-4 sm:text-sm"
            >
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)] min-w-0 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] lg:w-60 lg:border-b-0 lg:border-l">
          <nav
            className="flex gap-1.5 overflow-x-auto p-3 lg:sticky lg:top-16 lg:flex-col"
            aria-label="منوی پنل فروشگاه"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={
                  isActiveRoute(item.href) ? "page" : undefined
                }
                className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200 ${isActiveRoute(item.href)
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
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
