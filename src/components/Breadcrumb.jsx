
"use client";

import Link from "next/link";

export default function Breadcrumb({ items = [] }) {
    return (
        <nav
            aria-label="مسیر صفحه"
            className="mb-8 flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]"
        >
            <Link
                href="/"
                className="rounded-md transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
                خانه
            </Link>

            {items.map((item, index) => {
                const isLast = index === items.length - 1;

                return (
                    <div
                        key={item.href ?? item.label}
                        className="flex min-w-0 items-center gap-2"
                    >
                        <span
                            aria-hidden="true"
                            className="text-[var(--color-border)]"
                        >
                            /
                        </span>

                        {item.href ? (
                            <Link
                                href={item.href}
                                className="max-w-full truncate rounded-md transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span
                                aria-current={isLast ? "page" : undefined}
                                className="max-w-full truncate font-semibold text-[var(--color-text)]"
                            >
                                {item.label}
                            </span>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
