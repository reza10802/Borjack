"use client";

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!name || !identifier || !password) {
            setError("همه فیلدها الزامی هستند");
            return;
        }

        setLoading(true);

        try {
            await register(name, identifier, password);
            router.push("/");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
            <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm">

                <div className="flex justify-center mb-6">
                    <img src="/images/photo_2026-06-20_01-20-44.jpg" className="w-12 h-12 rounded-xl object-cover" alt="لوگو" />
                </div>

                <h1 className="text-xl font-bold text-center mb-6">ثبت‌نام</h1>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <input
                        type="text"
                        placeholder="نام و نام خانوادگی"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                        type="text"
                        placeholder="ایمیل یا شماره تلفن"
                        value={identifier}
                        onChange={e => setIdentifier(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                        type="password"
                        placeholder="رمز عبور"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" disabled={loading}
                        className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 transition disabled:opacity-50">
                        {loading ? "در حال ثبت‌نام..." : "ثبت‌نام"}
                    </button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4">
                    قبلاً ثبت‌نام کردی؟{" "}
                    <Link href="/login" className="text-black font-medium hover:underline">ورود</Link>
                </p>
            </div>
        </div>
    );
}