import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-zinc-200/60 dark:border-zinc-700/60 bg-white dark:bg-[#1E2640] text-zinc-700 dark:text-zinc-200">
      <div className="h-1 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-primary)]" />
      <div className="container-page py-16">

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 items-start">

          <div className="text-lg font-bold text-white mb-5">
            <div className="mb-5 flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="Borjak"
                width={48}
                height={48}
                className="rounded-2xl"
              />
              <span className="text-2xl font-black text-[var(--color-accent)]">
                BORJAK
              </span>
            </div>
            <Link className="text-lg font-bold text-zinc-900 dark:text-white text-white mb-5" href="/about">درباره ما</Link>
            <p className="text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              فروشگاه ما با هدف ارائه بهترین محصولات دیجیتال و پوشاک با قیمت مناسب فعالیت می‌کند.
            </p>
          </div>

          <div className="text-lg font-bold text-white mb-5">
            <h3 className="mb-5 text-base font-bold text-zinc-900 dark:text-white">دسترسی سریع</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">خانه</Link></li>
              <li><Link href="/search" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">محصولات</Link></li>
              <li><Link href="/cart" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">سبد خرید</Link></li>
              <li><Link href="/profile" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">پروفایل</Link></li>
              <li><Link href="/contact" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">تماس با ما</Link></li>
            </ul>
          </div>

          <div className="text-lg font-bold text-white mb-5">
            <h3 className="mb-4 text-sm font-bold">دسته‌بندی‌ها</h3>
            <ul className="space-y-3 text-sm">
              <li><Link href="/search?category=موبایل" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">موبایل</Link></li>
              <li><Link href="/search?category=لپ‌تاپ" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">لپ‌تاپ</Link></li>
              <li><Link href="/search?category=پوشاک" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">پوشاک</Link></li>
              <li><Link href="/search?category=لوازم جانبی" className="text-zinc-500 dark:text-zinc-400 hover:text-[var(--color-accent)] transition-colors">لوازم جانبی</Link></li>
            </ul>
          </div>

          <div className="text-lg font-bold text-white mb-5">
            <h3 className="mb-4 text-sm font-bold">تماس با ما</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">ایمیل: reza.nedae8080@gmail.com</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">تلفن: ۰۹۱۱۶۰۰۱۲۶۰</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">آدرس: تهران، میدان خراسان</p>
          </div>

        </div>

        <div className="mt-12 border-t border-zinc-200 dark:border-zinc-700 pt-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          © 2026 BORJAK — تمامی حقوق محفوظ است.
        </div>

      </div>
    </footer>
  );
}