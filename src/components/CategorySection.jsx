"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
    DevicePhoneMobileIcon,
    ComputerDesktopIcon,
    ShoppingBagIcon,
    SpeakerWaveIcon,
    TvIcon,
    ClockIcon
} from "@heroicons/react/24/outline";

const categoryIcons = {
    "موبایل": DevicePhoneMobileIcon,
    "لپ-تاپ": ComputerDesktopIcon,
    "پوشاک": ShoppingBagIcon,
    "هدفون": SpeakerWaveIcon,
    "دوربین": TvIcon,
    "ساعت": ClockIcon,

};

export default function CategorySection() {
    const [categories, setCategories] = useState([]);
    useEffect(() => {
        fetch("/api/categories")
            .then(r => r.ok ? r.json() : [])
            .then(d => setCategories(Array.isArray(d) ? d : []))
            .catch(() => setCategories([]));
    }, []);

    if (categories.length === 0) return null;

    return (
        <section className="py-10">
            <div className="mb-10">
                <h2 className="section-title">
                    دسته‌بندی‌ها
                </h2>

                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    سریع‌تر محصول مورد نظر خودت را پیدا کن
                </p>
            </div>
            <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
                {categories.map((category) => (
                    <Link
                        key={category.id}
                        href={`/search?category=${encodeURIComponent(category.title)}`}
                        className=" card group flex flex-col items-center justify-center p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)] hover:shadow-lg hover:shadow-[var(--color-accent)]/10 "
                    >
                        {(() => {
                            const Icon =
                                categoryIcons[category.slug] || categoryIcons.default;

                            return (
                                <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-[var(--color-accent)]/10 transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--color-accent)]">
                                    <Icon
                                        className="
                                    h-8 w-8
                                    text-zinc-700
                                    dark:text-[var(--color-accent)]
                                    group-hover:text-white
                                    transition-colors duration-300
        "
                                    />
                                </span>
                            );
                        })()}
                        <span className=" text-sm font-semibold text-zinc-500 dark:text-zinc-400 transition-colors duration-300 group-hover:text-[var(--color-accent)] ">{category.title}</span>
                    </Link>
                ))}
            </div>
        </section>
    );
}