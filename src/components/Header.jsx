"use client";
import SearchBar from "./SearchBar";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import CartIcon from "./CartIcon";
import Image from "next/image";
import ThemeToggle from "./ThemeToggle";
import { usePathname } from "next/navigation";

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { user, logout } = useAuth();

    const navLinks = [
        { label: "خانه", href: "/" },
        { label: "محصولات", href: "/search" },
        { label: "موبایل", href: "/search?category=موبایل" },
        { label: "لپ‌تاپ", href: "/search?category=لپ‌تاپ" },
        { label: "لوازم جانبی", href: "/search?category=لوازم جانبی" },
        { label: "پوشاک", href: "/search?category=پوشاک" },
        { label: "درباره ما", href: "/about" },
        { label: "ارتباط با ما", href: "/contact" },
    ];

    const pathname = usePathname();

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    return (
        <header
            className="sticky top-0 z-50 border-b border-zinc-200/50 dark:border-zinc-700/50 bg-white/90 dark:bg-[#1E2640]/95 backdrop-blur-xl shadow-sm"
        >

            <div className="container-page h-16 lg:h-20 flex items-center justify-between gap-6">

                <Link href="/" className="flex items-center shrink-0">
                    <Image
                        src="/images/logo.png"
                        alt="لوگو"
                        width={52}
                        height={52}
                        className="rounded-xl object-contain"
                    />
                </Link>

                <SearchBar className="hidden md:block flex-1 max-w-2xl mx-8" />
                <div className="flex items-center gap-3 shrink-0 h-12">
                    <ThemeToggle />
                    <CartIcon />

                    {user ? (
                        <>
                            {(user.role === "ADMIN" || user.role === "MANAGER") && (
                                <Link
                                    href="/admin"
                                    onClick={() => setMenuOpen(false)}
                                    className=" hidden md:flex h-11 items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 text-sm font-bold text-[var(--color-primary)] dark:text-[var(--color-accent)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:shadow-md"
                                >
                                    پنل ادمین
                                </Link>
                            )}
                            <Link href="/profile" className=" hidden md:flex h-11 items-center justify-center px-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-bold text-zinc-700 dark:text-zinc-200 transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-zinc-50 dark:hover:bg-zinc-800 ">
                                {user.name || "پروفایل"}
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="hidden md:flex h-11 items-center justify-center rounded-xl border border-transparent bg-[var(--color-primary)] px-5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)]">
                                ورود
                            </Link>
                            <Link href="/register" className="hidden md:flex h-11 items-center justify-center rounded-xl border border-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white">
                                ثبت‌نام
                            </Link>
                        </>
                    )}

                    <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="منو"
                        className=" md:hidden flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition hover:border-[var(--color-accent)] hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        {menuOpen ? (
                            <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* منو دسکتاپ */}
            <div className="hidden md:block border-t border-zinc-200/60 dark:border-zinc-800">
                <div className="container-page">
                    <nav className="flex items-center gap-2">
                        {navLinks.map((link) => (
                            <Link key={link.label} href={link.href}
                                className="relative px-5 py-4 text-sm font-medium text-zinc-600 transition hover:text-[var(--color-accent)] after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:w-0 after:-translate-x-1/2 after:bg-[var(--color-accent)] after:transition-all hover:after:w-3/4 dark:text-zinc-300">
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </div>

            {/* منوی موبایل */}
            {menuOpen && (
                <div className="md:hidden border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1E2640] px-4 pb-4">
                    <div className="mt-3 mb-3">
                        <SearchBar />
                    </div>
                    <nav className="flex flex-col">
                        {navLinks.map((link) => (
                            <Link key={link.label} href={link.href}
                                className="py-3 text-sm text-zinc-700 dark:text-zinc-300 border-b border-gray-100 last:border-0 hover:text-[var(--color-accent)] transition"
                                onClick={() => setMenuOpen(false)}>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex gap-2 mt-4">
                        {user ? (
                            <>
                                {(user.role === "ADMIN" || user.role === "MANAGER") && (
                                    <Link onClick={() => setMenuOpen(false)} href="/admin" className="flex-1 h-11 flex items-center justify-center text-sm border border-transparent bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                                        پنل ادمین
                                    </Link>
                                )}
                                <Link onClick={() => setMenuOpen(false)} href="/cart" className="flex-1 h-11 flex items-center justify-center text-sm border border-transparent bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                                    سبد خرید
                                </Link>
                                <Link
                                    href="/profile"
                                    onClick={() => setMenuOpen(false)}
                                    className="flex-1 h-11 flex items-center justify-center text-sm border border-transparent bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                                >
                                    پروفایل
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link onClick={() => setMenuOpen(false)} href="/login" className="flex-1 h-11 flex items-center justify-center text-sm border border-[var(--color-accent)] rounded-xl text-[var(--color-accent)] hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                                    ورود
                                </Link>
                                <Link onClick={() => setMenuOpen(false)} href="/register" className="flex-1 h-11 flex items-center justify-center text-sm border border-transparent bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl transition">
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