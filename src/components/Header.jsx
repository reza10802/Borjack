"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";
import CartIcon from "./CartIcon";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";

const staticNavLinks = [
    { label: "خانه", href: "/" },
    { label: "درباره ما", href: "/about" },
    { label: "ارتباط با ما", href: "/contact" },
];

function getCategoryHref(category) {
    return `/category/${encodeURIComponent(category.slug)}`;
}

function ChevronDown({ className = "" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 20 20"
            fill="none"
        >
            <path
                d="m5 7.5 5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function ArrowLeft({ className = "" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 20 20"
            fill="none"
        >
            <path
                d="M4 10h11m-4-4 4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function CategoryGridIcon({ className = "" }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            viewBox="0 0 24 24"
            fill="none"
        >
            <rect x="3.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13.5" y="3.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
            <rect x="3.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
            <rect x="13.5" y="13.5" width="7" height="7" rx="1.8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
}

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [megaMenuOpen, setMegaMenuOpen] = useState(false);
    const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
    const [categories, setCategories] = useState([]);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const { user } = useAuth();
    const pathname = usePathname();

    // Load the real categories from the public categories API.
    useEffect(() => {
        const controller = new AbortController();

        async function loadCategories() {
            try {
                const response = await fetch("/api/categories", {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(`Categories request failed: ${response.status}`);
                }

                const data = await response.json();
                setCategories(Array.isArray(data) ? data : []);
            } catch (error) {
                if (error.name !== "AbortError") {
                    console.error("Could not load header categories:", error);
                    setCategories([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setCategoriesLoading(false);
                }
            }
        }

        loadCategories();
        return () => controller.abort();
    }, []);

    // Close navigation panels after route changes.
    useEffect(() => {
        setMenuOpen(false);
        setMegaMenuOpen(false);
        setMobileCategoriesOpen(false);
    }, [pathname]);

    // Allow keyboard users to dismiss the desktop mega menu.
    useEffect(() => {
        if (!megaMenuOpen) return;

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setMegaMenuOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [megaMenuOpen]);

    const closeMobileMenu = () => {
        setMenuOpen(false);
        setMobileCategoriesOpen(false);
    };

    return (
        <header className="sticky top-0 z-50 border-b border-zinc-200/70 bg-white/95 shadow-sm backdrop-blur-xl dark:border-zinc-700/60 dark:bg-[#1E2640]/95">
            {/* Top row: brand, search, account and cart */}
            <div className="container-page flex h-16 items-center justify-between gap-3 sm:gap-5 lg:h-20 lg:gap-6">
                <Link href="/" className="flex shrink-0 items-center" aria-label="صفحه اصلی برجک">
                    <Image
                        src="/images/logo.png"
                        alt="لوگوی برجک"
                        width={52}
                        height={52}
                        priority
                        className="rounded-xl object-contain"
                    />
                </Link>

                <SearchBar className="mx-4 hidden max-w-2xl flex-1 md:block lg:mx-8" />

                <div className="flex h-12 shrink-0 items-center gap-2 sm:gap-3">
                    <ThemeToggle />
                    <CartIcon />

                    {user ? (
                        <>
                            {user.role === "ADMIN" && (
                                <Link
                                    href="/admin"
                                    className="hidden h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-bold text-[var(--color-primary)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-[var(--color-accent)] dark:hover:bg-zinc-800 md:flex"
                                >
                                    پنل ادمین
                                </Link>
                            )}

                            {user.role === "SUPPLIER" && (
                                <Link
                                    href="/supplier"
                                    className="hidden h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-bold text-[var(--color-primary)] transition-all duration-200 hover:border-[var(--color-accent)] hover:bg-zinc-50 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-[var(--color-accent)] dark:hover:bg-zinc-800 md:flex"
                                >
                                    پنل فروشگاه
                                </Link>
                            )}

                            <Link
                                href="/profile"
                                className="hidden h-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-bold text-zinc-700 transition hover:border-[var(--color-accent)] hover:bg-zinc-50 hover:text-[var(--color-accent)] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 md:flex"
                            >
                                {user.name || "پروفایل"}
                            </Link>
                        </>
                    ) : (
                        <>
                            <Link
                                href="/login"
                                className="hidden h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-5 text-sm font-medium text-white transition hover:bg-[var(--color-primary-hover)] md:flex"
                            >
                                ورود
                            </Link>
                            <Link
                                href="/register"
                                className="hidden h-11 items-center justify-center rounded-xl border border-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-white md:flex"
                            >
                                ثبت‌نام
                            </Link>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={() => setMenuOpen((current) => !current)}
                        aria-label={menuOpen ? "بستن منو" : "باز کردن منو"}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-navigation"
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white transition hover:border-[var(--color-accent)] hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 md:hidden"
                    >
                        {menuOpen ? (
                            <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-zinc-700 dark:text-zinc-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>

            {/* Desktop navigation and mega menu */}
            <div
                className="relative hidden border-t border-zinc-200/70 dark:border-zinc-800 md:block"
                onMouseLeave={() => setMegaMenuOpen(false)}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        setMegaMenuOpen(false);
                    }
                }}
            >
                <div className="container-page">
                    <nav aria-label="منوی اصلی" className="flex items-center gap-1">
                        <Link
                            href="/"
                            onMouseEnter={() => setMegaMenuOpen(false)}
                            className="relative px-4 py-4 text-sm font-medium text-zinc-600 transition hover:text-[var(--color-accent)] dark:text-zinc-300"
                        >
                            خانه
                        </Link>

                        <button
                            type="button"
                            aria-expanded={megaMenuOpen}
                            aria-controls="products-mega-menu"
                            onMouseEnter={() => setMegaMenuOpen(true)}
                            onFocus={() => setMegaMenuOpen(true)}
                            onClick={() => setMegaMenuOpen(true)}
                            className={`relative flex items-center gap-2 px-4 py-4 text-sm font-bold transition hover:text-[var(--color-accent)] ${
                                megaMenuOpen
                                    ? "text-[var(--color-accent)]"
                                    : "text-zinc-700 dark:text-zinc-200"
                            }`}
                        >
                            محصولات
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
                            <span className={`absolute inset-x-4 bottom-0 h-0.5 origin-center rounded-full bg-[var(--color-accent)] transition-transform duration-200 ${megaMenuOpen ? "scale-x-100" : "scale-x-0"}`} />
                        </button>

                        {staticNavLinks.slice(1).map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onMouseEnter={() => setMegaMenuOpen(false)}
                                className="relative px-4 py-4 text-sm font-medium text-zinc-600 transition hover:text-[var(--color-accent)] dark:text-zinc-300"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                </div>

                {megaMenuOpen && (
                    <div
                        id="products-mega-menu"
                        className="absolute inset-x-0 top-full z-50 border-y border-zinc-200/80 bg-white/[0.98] shadow-2xl shadow-slate-900/10 backdrop-blur-2xl dark:border-zinc-700 dark:bg-[#171f33]/[0.98]"
                    >
                        <div className="container-page py-5 sm:py-7">
                            <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-7">
                                {/* Intro and all-products action */}
                                <aside className="relative flex flex-col justify-between overflow-hidden rounded-3xl bg-[#1e2640] p-5 text-white sm:p-6">
                                    <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-[var(--color-accent)]/20 blur-3xl" />
                                    <div className="relative">
                                        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[var(--color-accent-light)]">
                                            <CategoryGridIcon className="h-6 w-6" />
                                        </span>
                                        <p className="text-xs font-medium text-white/60">فروشگاه آنلاین برجک</p>
                                        <h2 className="mt-2 text-xl font-extrabold leading-8">از بین دسته‌بندی‌ها انتخاب کن</h2>
                                        <p className="mt-2 text-sm leading-7 text-white/65">
                                            محصولات موردنظرت رو سریع‌تر پیدا کن و دسته‌بندی دلخواهت رو ببین.
                                        </p>
                                    </div>
                                    <Link
                                        href="/search"
                                        onClick={() => setMegaMenuOpen(false)}
                                        className="relative mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)]"
                                    >
                                        مشاهده همه محصولات
                                        <ArrowLeft className="h-4 w-4" />
                                    </Link>
                                </aside>

                                {/* Categories fetched from /api/categories */}
                                <section className="min-w-0">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className="text-base font-extrabold text-[var(--color-text)] sm:text-lg">دسته‌بندی محصولات</h2>
                                            <p className="mt-1 text-xs text-[var(--color-text-muted)]">یک دسته را برای دیدن محصولات انتخاب کن</p>
                                        </div>
                                        {!categoriesLoading && categories.length > 0 && (
                                            <span className="shrink-0 rounded-full bg-[var(--color-surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                                                {categories.length} دسته
                                            </span>
                                        )}
                                    </div>

                                    {categoriesLoading ? (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {Array.from({ length: 6 }).map((_, index) => (
                                                <div key={index} className="h-[74px] animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]" />
                                            ))}
                                        </div>
                                    ) : categories.length > 0 ? (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {categories.map((category) => (
                                                <Link
                                                    key={category.id}
                                                    href={getCategoryHref(category)}
                                                    onClick={() => setMegaMenuOpen(false)}
                                                    className="group flex min-h-[74px] items-center justify-between gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)] hover:shadow-md sm:px-4"
                                                >
                                                    <span className="flex min-w-0 items-center gap-2.5">
                                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-primary)] transition group-hover:bg-[var(--color-accent)] group-hover:text-white dark:text-[var(--color-accent-light)]">
                                                            <CategoryGridIcon className="h-[18px] w-[18px]" />
                                                        </span>
                                                        <span className="line-clamp-2 text-sm font-bold leading-6 text-[var(--color-text)]">{category.title}</span>
                                                    </span>
                                                    <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition group-hover:-translate-x-1 group-hover:text-[var(--color-accent)]" />
                                                </Link>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-2xl border border-dashed border-[var(--color-border)] px-4 py-8 text-center">
                                            <p className="text-sm text-[var(--color-text-muted)]">در حال حاضر دسته‌بندی‌ای برای نمایش وجود ندارد.</p>
                                            <Link href="/search" onClick={() => setMegaMenuOpen(false)} className="mt-3 inline-flex text-sm font-bold text-[var(--color-accent)] hover:underline">
                                                مشاهده همه محصولات
                                            </Link>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile navigation */}
            {menuOpen && (
                <div id="mobile-navigation" className="border-t border-zinc-200 bg-white px-4 pb-5 dark:border-zinc-700 dark:bg-[#1E2640] md:hidden">
                    <div className="mb-3 mt-4">
                        <SearchBar />
                    </div>

                    <nav aria-label="منوی موبایل" className="flex flex-col">
                        <Link
                            href="/"
                            onClick={closeMobileMenu}
                            className="border-b border-zinc-100 py-3 text-sm font-medium text-zinc-700 transition hover:text-[var(--color-accent)] dark:border-zinc-800 dark:text-zinc-200"
                        >
                            خانه
                        </Link>

                        <Link
                            href="/search"
                            onClick={closeMobileMenu}
                            className="border-b border-zinc-100 py-3 text-sm font-medium text-zinc-700 transition hover:text-[var(--color-accent)] dark:border-zinc-800 dark:text-zinc-200"
                        >
                            همه محصولات
                        </Link>

                        <div className="border-b border-zinc-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setMobileCategoriesOpen((current) => !current)}
                                aria-expanded={mobileCategoriesOpen}
                                className="flex w-full items-center justify-between gap-3 py-3 text-right text-sm font-bold text-zinc-700 transition hover:text-[var(--color-accent)] dark:text-zinc-200"
                            >
                                <span className="flex items-center gap-2">
                                    دسته بندی محصولات
                                </span>
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileCategoriesOpen ? "rotate-180" : ""}`} />
                            </button>

                            {mobileCategoriesOpen && (
                                <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl p-2">
                                    {categoriesLoading ? (
                                        <p className="col-span-2 px-2 py-3 text-xs text-[var(--color-text-muted)]">در حال دریافت دسته‌بندی‌ها...</p>
                                    ) : categories.length > 0 ? (
                                        categories.map((category) => (
                                            <Link
                                                key={category.id}
                                                href={getCategoryHref(category)}
                                                onClick={closeMobileMenu}
                                                className="rounded-xl bg-[var(--color-surface)] px-3 py-2.5 text-sm text-[var(--color-text)] transition hover:text-[var(--color-accent)]"
                                            >
                                                {category.title}
                                            </Link>
                                        ))
                                    ) : (
                                        <p className="col-span-2 px-2 py-3 text-xs text-[var(--color-text-muted)]">دسته‌بندی‌ای برای نمایش وجود ندارد.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {staticNavLinks.slice(1).map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={closeMobileMenu}
                                className="border-b border-zinc-100 py-3 text-sm font-medium text-zinc-700 transition last:border-0 hover:text-[var(--color-accent)] dark:border-zinc-800 dark:text-zinc-200"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    <div className="mt-4 flex gap-2">
                        {user ? (
                            <>
                                {user.role === "ADMIN" && (
                                    <Link onClick={closeMobileMenu} href="/admin" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                                        پنل ادمین
                                    </Link>
                                )}
                                {user.role === "SUPPLIER" && (
                                    <Link onClick={closeMobileMenu} href="/supplier" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                                        پنل فروشگاه
                                    </Link>
                                )}
                                <Link onClick={closeMobileMenu} href="/cart" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                                    سبد خرید
                                </Link>
                                <Link onClick={closeMobileMenu} href="/profile" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-zinc-100 text-sm text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700">
                                    پروفایل
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link onClick={closeMobileMenu} href="/login" className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[var(--color-accent)] text-sm text-[var(--color-accent)] transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                    ورود
                                </Link>
                                <Link onClick={closeMobileMenu} href="/register" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[var(--color-primary)] text-sm text-white transition hover:bg-[var(--color-primary-hover)]">
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
