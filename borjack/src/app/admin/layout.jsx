"use client";
import { useAuth } from "../../context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

const navItems = [
  { label: "داشبورد", href: "/admin", icon: "⬛", roles: ["ADMIN", "MANAGER"] },
  { label: "کالاها", href: "/admin/products", icon: "📦", roles: ["ADMIN"] },
  { label: "انبارداری", href: "/admin/inventory", icon: "🏭", roles: ["ADMIN"] },
  { label: "سفارشات", href: "/admin/orders", icon: "🛒", roles: ["ADMIN", "MANAGER"] },
  { label: "کاربران", href: "/admin/users", icon: "👥", roles: ["ADMIN"] },
  { label: "لاگ‌ها", href: "/admin/logs", icon: "📋", roles: ["ADMIN"] },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", icon: "◈", roles: ["ADMIN"] },
  { label: "نظرات", href: "/admin/reviews", icon: "💬", roles: ["ADMIN"] },
];

export default function AdminLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/login");
      else if (!["ADMIN", "MANAGER"].includes(user.role)) router.replace("/403");
    }
  }, [user, loading]);

  if (loading || !user) return null;

  const visibleNav = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Topbar */}
      <header className="bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-sm text-gray-500 hover:text-black transition">
            ← بازگشت به سایت
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-semibold text-gray-800">پنل مدیریت</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.name}</span>
          <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${
            user.role === "ADMIN" ? " text-gray-600" : "bg-gray-200 text-gray-700"
          }`}>
            {user.role === "ADMIN" ? "ادمین" : "منیجر"}
          </span>
          <button
            onClick={logout}
            className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition"
          >
            خروج
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-52 bg-white border-l border-gray-200 flex flex-col py-4 sticky top-14 h-[calc(100vh-3.5rem)]">
          <nav className="flex flex-col gap-1 px-3">
            {visibleNav.map((item) => {
              const isActive = pathname === item.href;
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
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}