import Link from "next/link";

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir="rtl">
            <div className="text-center">
                <p className="text-8xl font-black text-black mb-4">404</p>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">صفحه پیدا نشد</h1>
                <p className="text-sm text-gray-500 mb-8">صفحه‌ای که دنبالش می‌گردی وجود نداره یا حذف شده</p>
                <div className="flex items-center justify-center gap-3">
                    <Link href="/"
                        className="px-6 py-2.5 bg-black text-white text-sm rounded-xl hover:bg-gray-800 transition">
                        بازگشت به خانه
                    </Link>
                    <Link href="/search"
                        className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition">
                        جستجوی محصولات
                    </Link>
                </div>
            </div>
        </div>
    );
}