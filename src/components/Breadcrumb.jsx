"use client";

import Link from "next/link";

export default function Breadcrumb({ items }) {
  return (
    <nav aria-label="breadcrumb" className="mb-8 flex flex-wrap items-center gap-2 text-sm">

      <Link
        href="/"
        className="text-zinc-500 hover:text-orange-500 transition"
      >
        خانه
      </Link>

      {items.map((item, index) => (
        <div
          key={item.href ?? item.label}
          className="flex items-center gap-2"
        >
          <span className="text-zinc-400">/</span>

          {item.href ? (
            <Link
              href={item.href}
              className="text-zinc-500 hover:text-orange-500 transition"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-zinc-800">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}