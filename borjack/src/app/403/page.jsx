// src/app/403/page.jsx

import Link from "next/link";

export const metadata = {
  title: "دسترسی ممنوع | Borjack",
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <p className="text-6xl font-bold text-gray-300 mb-4">403</p>
      <h1 className="text-2xl font-semibold mb-2">دسترسی ممنوع</h1>
      <p className="text-gray-500 mb-8">
        شما مجوز مشاهده این صفحه را ندارید.
      </p>
      <Link
        href="/"
        className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}