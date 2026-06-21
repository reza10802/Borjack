"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, logout } = useAuth();

    const navLinks = [
        { label: "موبایل", href: "#" },
        { label: "لپ‌تاپ", href: "#" },
        { label: "لوازم جانبی", href: "#" },
        { label: "پوشاک", href: "#" },
    ];

    return (
        <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50" dir="rtl">

            {/* نوار اصلی */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

                {/* لوگو */}
                <Link href="/" className="flex items-center shrink-0">
                    <img
                        src="/images/photo_2026-06-20_01-20-44.jpg"
                        alt="لوگوی سایت"
                        className="w-12 h-12 rounded-xl object-cover"
                    />
                </Link>

                {/* سرچ */}
                <div className="flex-1 max-w-md hidden sm:block">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="جستجو در محصولات..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition pr-10"
                        />
                        <svg className="absolute top-2.5 right-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                    </div>
                </div>

                {/* دکمه‌ها */}
                <div className="flex items-center gap-2 shrink-0">

                    {user ? (
                        <>
                            {/* سبد خرید — فقط بعد از لاگین */}
                            <Link href="/cart" className="relative p-2 rounded-xl hover:bg-gray-100 transition">
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m12-9l2 9M9 21a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" />
                                </svg>
                                <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                                    ۰
                                </span>
                            </Link>

                            {/* پروفایل */}
                            <Link
                                href="/profile"
                                className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                            >
                                {user.name || "پروفایل"}
                            </Link>

                            {/* خروج */}
                            <button
                                onClick={logout}
                                className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition"
                            >
                                خروج
                            </button>
                        </>
                    ) : (
                        <>
                            {/* ورود */}
                            <Link
                                href="/login"
                                className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                            >
                                ورود
                            </Link>

                            {/* ثبت نام */}
                            <Link
                                href="/register"
                                className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition"
                            >
                                ثبت‌نام
                            </Link>
                        </>
                    )}

                    {/* همبرگر — موبایل */}
                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition"
                        aria-label="منو"
                    >
                        {menuOpen ? (
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* نوار منو — دسکتاپ */}
            <div className="hidden md:block border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6">
                    <nav className="flex gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="px-4 py-3 text-sm text-gray-600 hover:text-black hover:bg-gray-50 transition rounded-b-lg font-medium"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {/* منوی موبایل */}
            {menuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">

                    {/* سرچ موبایل */}
                    <div className="relative mt-3 mb-3">
                        <input
                            type="text"
                            placeholder="جستجو..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition pr-10"
                        />
                        <svg className="absolute top-3 right-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                        </svg>
                    </div>

                    {/* لینک‌های منو */}
                    <nav className="flex flex-col">
                        {navLinks.map((link) => (
                            <Link
                                key={link.label}
                                href={link.href}
                                className="py-3 text-sm text-gray-700 border-b border-gray-100 last:border-0 hover:text-black transition"
                                onClick={() => setMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* دکمه‌های موبایل */}
                    <div className="flex gap-2 mt-4">
                        {user ? (
                            <>
                                <Link href="/cart" className="flex-1 text-center py-2 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition">
                                    سبد خرید
                                </Link>
                                <button onClick={logout} className="flex-1 text-center py-2 text-sm bg-black text-white rounded-xl hover:bg-gray-800 transition">
                                    خروج
                                </button>
                            </>
                        ) : (
                            <>
                                <Link href="/login" className="flex-1 text-center py-2 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition">
                                    ورود
                                </Link>
                                <Link href="/register" className="flex-1 text-center py-2 text-sm bg-black text-white rounded-xl hover:bg-gray-800 transition">
                                    ثبت‌نام
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            )}

        </header>
    );
}
