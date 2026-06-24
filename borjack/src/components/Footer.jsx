import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">

          <div>
            <h3 className="mb-4 text-sm font-bold">درباره ما</h3>
            <p className="text-sm text-gray-600 leading-6">
              فروشگاه ما با هدف ارائه بهترین محصولات دیجیتال و پوشاک با قیمت مناسب فعالیت می‌کند.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold">دسترسی سریع</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/" className="hover:text-black transition">خانه</Link></li>
              <li><Link href="/search" className="hover:text-black transition">محصولات</Link></li>
              <li><Link href="/cart" className="hover:text-black transition">سبد خرید</Link></li>
              <li><Link href="/profile" className="hover:text-black transition">پروفایل</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold">دسته‌بندی‌ها</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><Link href="/search?category=موبایل" className="hover:text-black transition">موبایل</Link></li>
              <li><Link href="/search?category=لپ‌تاپ" className="hover:text-black transition">لپ‌تاپ</Link></li>
              <li><Link href="/search?category=پوشاک" className="hover:text-black transition">پوشاک</Link></li>
              <li><Link href="/search?category=لوازم جانبی" className="hover:text-black transition">لوازم جانبی</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-bold">تماس با ما</h3>
            <p className="text-sm text-gray-600">ایمیل: info@shop.com</p>
            <p className="text-sm text-gray-600 mt-2">تلفن: 0000-000-000</p>
          </div>

        </div>

        <div className="mt-10 border-t pt-6 text-center text-sm text-gray-500">
          © 2026 MyShop. All rights reserved.
        </div>

      </div>
    </footer>
  );
}