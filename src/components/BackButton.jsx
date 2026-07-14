"use client";

import { useRouter } from "next/navigation";

export default function BackButton({ label = "بازگشت" }) {
    const router = useRouter();
    return (
        <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-black transition mb-6"
        >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {label}
        </button>
    );
}