
"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "بازگشت" }) {
    const router = useRouter();

    return (
        <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors duration-200 hover:bg-[var(--color-surface-2)] hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
            <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                />
            </svg>
            <span>{label}</span>
        </button>
    );
}
