"use client";

import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700" />
    );
  }

  return (
    <button
      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 transition hover:border-[var(--color-accent)] hover:bg-zinc-50 dark:hover:bg-zinc-800"
      onClick={() =>
        setTheme(theme === "dark" ? "light" : "dark")
      }
    >
      {theme === "dark" ? (
        <SunIcon className="w-5 h-5 text-yellow-400" />
      ) : (
        <MoonIcon className="w-5 h-5 text-slate-700" />
      )}
    </button>
  );
}