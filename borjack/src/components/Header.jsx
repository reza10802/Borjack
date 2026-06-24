"use client";
import SearchBar from "./SearchBar";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import CartIcon from "./CartIcon";

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, logout } = useAuth();

    const navLinks = [
        { label: "موبایل", href: "/search?category=موبایل" },
        { label: "لپ‌تاپ", href: "/search?category=لپ‌تاپ" },
        { label: "لوازم جانبی", href: "/search?category=لوازم جانبی" },
        { label: "پوشاک", href: "/search?category=پوشاک" },
    ];

    return (
        <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50" dir="rtl">

            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

                <Link href="/" className="flex items-center shrink-0">
                    <img src="/images/photo_2026-06-20_01-20-44.jpg" alt="لوگوی سایت" className="w-12 h-12 rounded-xl object-cover" />
                </Link>

                <SearchBar className="flex-1 max-w-md hidden sm:block" />

                <div className="flex items-center gap-2 shrink-0">
                    {user ? (
                        <>
                            <CartIcon />
                            <Link href="/profile" className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
                                {user.name || "پروفایل"}
                            </Link>
                            <button onClick={logout} className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition">
                                خروج
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition">
                                ورود
                            </Link>
                            <Link href="/register" className="hidden sm:inline-flex px-4 py-1.5 text-sm rounded-xl bg-black text-white hover:bg-gray-800 transition">
                                ثبت‌نام
                            </Link>
                        </>
                    )}

                    <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl hover:bg-gray-100 transition" aria-label="منو">
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

            {/* منو دسکتاپ */}
            <div className="hidden md:block border-t border-gray-100">
                <div className="max-w-7xl mx-auto px-6">
                    <nav className="flex gap-1">
                        {navLinks.map((link) => (
                            <Link key={link.label} href={link.href}
                                className="px-4 py-3 text-sm text-gray-600 hover:text-black hover:bg-gray-50 transition rounded-b-lg font-medium">
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {/* منوی موبایل */}
            {menuOpen && (
                <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4">
                    <div className="mt-3 mb-3">
                        <SearchBar />
                    </div>
                    <nav className="flex flex-col">
                        {navLinks.map((link) => (
                            <Link key={link.label} href={link.href}
                                className="py-3 text-sm text-gray-700 border-b border-gray-100 last:border-0 hover:text-black transition"
                                onClick={() => setMenuOpen(false)}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
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