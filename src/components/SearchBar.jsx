"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// تبدیل حروفی که با کیبورد انگلیسی به‌جای فارسی تایپ شده‌اند
const PERSIAN_KEYBOARD_MAP = {
    q: "ض",
    w: "ص",
    e: "ث",
    r: "ق",
    t: "ف",
    y: "غ",
    u: "ع",
    i: "ه",
    o: "خ",
    p: "ح",
    "[": "ج",
    "]": "چ",

    a: "ش",
    s: "س",
    d: "ی",
    f: "ب",
    g: "ل",
    h: "ا",
    j: "ت",
    k: "ن",
    l: "م",
    ";": "ک",
    "'": "گ",

    z: "ظ",
    x: "ط",
    c: "ز",
    v: "ر",
    b: "ذ",
    n: "د",
    m: "ئ",
    ",": "و",
    "\\": "پ",
};

// نام‌های جایگزین برند برجک
const BRAND_SEARCH_ALIASES = {
    borjak: "برجک",
    borjack: "برجک",
    "borjak shop": "فروشگاه برجک",
    "borjack shop": "فروشگاه برجک",
};

// تبدیل یک عبارت تایپ‌شده با چیدمان اشتباه کیبورد
function convertKeyboardLayout(text) {
    return [...text]
        .map((character) => {
            const lowerCharacter = character.toLowerCase();

            return PERSIAN_KEYBOARD_MAP[lowerCharacter] ?? character;
        })
        .join("");
}

// اصلاح عبارت جست‌وجو
export function normalizeSearchQuery(value) {
    const query = String(value ?? "").trim();

    if (!query) {
        return "";
    }

    // تشخیص نام برند با حروف انگلیسی
    const normalizedEnglish = query
        .toLowerCase()
        .replace(/\s+/g, " ");

    if (BRAND_SEARCH_ALIASES[normalizedEnglish]) {
        return BRAND_SEARCH_ALIASES[normalizedEnglish];
    }

    // تبدیل فقط عبارت‌هایی که نشانه‌های خاص چیدمان فارسی دارند.
    // این شرط باعث می‌شود کلمات عادی انگلیسی مانند Samsung دست‌نخورده بمانند.
    const hasPersianKeyboardSymbols = /[\[\];,\\]/.test(query);

    if (!hasPersianKeyboardSymbols) {
        return query;
    }

    // تبدیل بخش‌های اشتباه تایپ‌شده، بدون تغییر بخش‌های عادی انگلیسی
    return query
        .split(/(\s+)/)
        .map((part) => {
            if (!part.trim()) {
                return part;
            }

            if (/[\[\];,\\]/.test(part)) {
                return convertKeyboardLayout(part);
            }

            return part;
        })
        .join("")
        .trim();
}

export default function SearchBar({ className = "" }) {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const handleSubmit = (event) => {
        event.preventDefault();

        const normalizedQuery = normalizeSearchQuery(query);

        if (!normalizedQuery) {
            return;
        }

        const params = new URLSearchParams({
            q: normalizedQuery,
        });

        router.push(`/search?${params.toString()}`);
    };

    return (
        <form
            role="search"
            onSubmit={handleSubmit}
            className={`relative h-11 w-full ${className}`}
        >
            <input
                type="search"
                name="q"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="دنبال چه محصولی می‌گردی؟"
                aria-label="جست‌وجوی محصولات فروشگاه برجک"
                autoComplete="off"
                dir="auto"
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pr-12 pl-4 text-sm text-zinc-700 outline-none transition placeholder:text-zinc-400 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            />

            <button
                type="submit"
                aria-label="جست‌وجو"
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
                <svg
                    aria-hidden="true"
                    className="h-5 w-5 text-zinc-400 transition hover:text-[var(--color-accent)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
                    />
                </svg>
            </button>
        </form>
    );
}