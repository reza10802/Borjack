"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SearchBar({ className = "" }) {
    const [query, setQuery] = useState("");
    const router = useRouter();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`relative h-11 w-full ${className}`}
        >
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="دنبال چه محصولی می‌گردی؟"
                className=" h-11 w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 pr-12 pl-4 text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"/>

            <button
                type="submit"
                className=" absolute right-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-xl transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
                <svg
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