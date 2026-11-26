
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";

const footerLinkClass =
  "text-zinc-500 transition-colors hover:text-[var(--color-accent)] dark:text-zinc-400";

const quickLinks = [
  { label: "خانه", href: "/" },
  { label: "درباره ما", href: "/about" },
  { label: "محصولات", href: "/search" },
  { label: "تماس با ما", href: "/contact" },
  { label: "قوانین و مقررات", href: "/rules" },
  { label: "نصب اپلیکیشن برجک", href: "/install" },
  { label: "سبد خرید", href: "/cart" },
  { label: "پروفایل", href: "/profile" },
];

const phoneContacts = [
  {
    label: "تلفن اصلی",
    number: "۰۹۱۱۶۰۰۱۲۶۰",
    href: "tel:+989116001260",
  },
  {
    label: "تلفن دوم",
    number: "۰۹۰۳۸۷۷۵۶۱۶",
    href: "tel:+989038775616",
  },
];

async function getFooterCategories() {
  try {
    return await prisma.category.findMany({
      where: {
        products: {
          some: {
            isPublished: true,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
      orderBy: {
        title: "asc",
      },
    });
  } catch (error) {
    console.error("Failed to load footer categories:", error);
    return [];
  }
}

export default async function Footer() {
  const categories = await getFooterCategories();

  return (
    <footer className="mt-20 border-t border-zinc-200/60 bg-white text-zinc-700 dark:border-zinc-700/60 dark:bg-[#1E2640] dark:text-zinc-200">
      <div className="h-1 bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-accent)] to-[var(--color-primary)]" />

      <div className="container-page py-12 sm:py-16">
        <div className="grid items-start gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="mb-5 inline-flex items-center gap-3"
              aria-label="صفحه اصلی برجک"
            >
              <Image
                src="/images/logo.png"
                alt="لوگوی برجک"
                width={48}
                height={48}
                className="rounded-2xl object-contain"
              />

              <span className="text-2xl font-black text-[var(--color-accent)]">
                BORJAK
              </span>
            </Link>

            <p className="mb-5 text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              فروشگاه اینترنتی برجک با هدف ارائه محصولات متنوع از فروشندگان
              مختلف و فراهم‌کردن تجربه خرید آسان فعالیت می‌کند.
            </p>

            <Link
              href="/about"
              className="text-sm font-bold text-[var(--color-accent)] hover:underline"
            >
              بیشتر درباره ما ←
            </Link>
          </div>

          {/* Quick links */}
          <nav aria-label="دسترسی سریع">
            <h3 className="mb-5 text-base font-bold text-zinc-900 dark:text-white">
              دسترسی سریع
            </h3>

            <ul className="space-y-3 text-sm">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={footerLinkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Categories */}
          <nav aria-label="دسته‌بندی محصولات">
            <h3 className="mb-5 text-base font-bold text-zinc-900 dark:text-white">
              دسته‌بندی محصولات
            </h3>

            <ul className="space-y-3 text-sm">
              {categories.length > 0 ? (
                categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/category/${encodeURIComponent(category.slug)}`}
                      className={footerLinkClass}
                    >
                      {category.title}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-zinc-500 dark:text-zinc-400">
                  دسته‌بندی‌ای برای نمایش وجود ندارد.
                </li>
              )}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <h3 className="mb-5 text-base font-bold text-zinc-900 dark:text-white">
              تماس با ما
            </h3>

            <address className="not-italic">
              <div className="space-y-3 text-sm text-zinc-500 dark:text-zinc-400">
                <p>
                  ایمیل:{" "}
                  <a
                    href="mailto:reza.nedae8080@gmail.com"
                    className="transition-colors hover:text-[var(--color-accent)]"
                  >
                    reza.nedae8080@gmail.com
                  </a>
                </p>

                {phoneContacts.map((phone) => (
                  <p key={phone.href}>
                    {phone.label}:{" "}
                    <a
                      href={phone.href}
                      dir="ltr"
                      className="inline-block transition-colors hover:text-[var(--color-accent)]"
                    >
                      {phone.number}
                    </a>
                  </p>
                ))}

                <p>آدرس: تهران، میدان خراسان</p>
              </div>
            </address>
          </div>
        </div>

        {/* Payment and trust */}
        <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-700">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <p>خریدی امن با نماد اعتماد الکترونیکی</p>
              <p>پرداخت از طریق درگاه‌های امن بانکی</p>
            </div>

            <div className="flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white px-6 py-4 shadow-md dark:border-zinc-700 dark:bg-zinc-200">
              {/* Enamad */}
              <a
                referrerPolicy="origin"
                target="_blank"
                rel="noopener noreferrer"
                href="https://trustseal.enamad.ir/?id=769934&Code=feow9op4jNHTPQg6uAEfJy931bamyQw2"
                aria-label="مشاهده نماد اعتماد الکترونیکی برجک"
              >
                <img
                  src="https://trustseal.enamad.ir/logo.aspx?id=769934&Code=feow9op4jNHTPQg6uAEfJy931bamyQw2"
                  alt="نماد اعتماد الکترونیکی"
                  width="100"
                  height="100"
                  loading="lazy"
                  referrerPolicy="origin"
                  className="h-20 w-auto cursor-pointer object-contain"
                />
              </a>

              <Image
                src="/images/zarinpal.svg"
                width={80}
                height={80}
                alt="لوگوی زرین‌پال"
                className="object-contain transition hover:scale-105"
              />
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-zinc-200 pt-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          © {new Date().getFullYear()} BORJAK — تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  );
}
