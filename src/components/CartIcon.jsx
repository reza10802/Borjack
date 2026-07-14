"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function CartIcon() {
    const { user } = useAuth();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!user) { setCount(0); return; }
        fetchCount();

        // وقتی جای دیگه‌ای از اپ سبد خرید رو عوض کرد (افزودن، حذف، تغییر تعداد، پرداخت)
        // اون بخش یه رویداد "cart-updated" پخش می‌کنه و این‌جا دوباره فچ می‌کنیم
        window.addEventListener("cart-updated", fetchCount);
        return () => window.removeEventListener("cart-updated", fetchCount);
    }, [user]);

    const fetchCount = async () => {
        try {
            const res = await fetch("/api/cart");
            if (!res.ok) return;
            const data = await res.json();
            const total = data.reduce((sum, item) => sum + item.quantity, 0);
            setCount(total);
        } catch {}
    };

    if (!user) return null;

    return (
        <Link href="/cart" className="relative p-2 rounded-xl hover:bg-gray-100 transition">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m12-9l2 9M9 21a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
            {count > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-black text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                    {count > 9 ? "9+" : count}
                </span>
            )}
        </Link>
    );
}