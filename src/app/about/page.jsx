
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Headphones,
  HeartHandshake,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "درباره ما",
  description:
    "با برجک (Borjak)، فروشگاه اینترنتی عرضه محصولات متنوع از طریق همکاری با تأمین‌کنندگان آشنا شوید. درباره شیوه فعالیت، ثبت سفارش و پیگیری خرید بخوانید.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    title: "درباره ما | برجک",
    description:
      "آشنایی با فروشگاه اینترنتی برجک (Borjak)، شیوه فعالیت، همکاری با تأمین‌کنندگان و فرایند ثبت و پیگیری سفارش‌ها.",
    url: "/about",
    siteName: "برجک",
    locale: "fa_IR",
  },
};

const values = [
  {
    icon: Search,
    title: "انتخاب آگاهانه",
    text: "تلاش می‌کنیم اطلاعات و مشخصات محصولات را به شکلی روشن در اختیار شما قرار دهیم تا بتوانید با آگاهی بیشتری انتخاب کنید.",
  },
  {
    icon: ShieldCheck,
    title: "شفافیت در خرید",
    text: "ارائه اطلاعات روشن درباره محصولات، قیمت‌ها و شرایط سفارش، بخش مهمی از تجربه خرید قابل‌اعتماد است.",
  },
  {
    icon: Headphones,
    title: "همراهی با مشتری",
    text: "ارتباط با مشتریان، پاسخ‌گویی به پرسش‌ها و پیگیری سفارش‌ها از بخش‌های مهم فعالیت برجک است.",
  },
];

const steps = [
  {
    number: "۰۱",
    title: "بررسی محصولات",
    text: "محصولات و دسته‌بندی‌ها را مشاهده کنید و مشخصات و شرایط هر محصول را بررسی کنید.",
  },
  {
    number: "۰۲",
    title: "ثبت سفارش",
    text: "محصول موردنظر را انتخاب کنید و اطلاعات لازم برای ثبت سفارش را وارد کنید.",
  },
  {
    number: "۰۳",
    title: "پیگیری سفارش",
    text: "وضعیت سفارش خود را از طریق حساب کاربری دنبال کنید و در صورت نیاز با پشتیبانی برجک تماس بگیرید.",
  },
];

export default function AboutPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]"
    >
      <Header />

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden bg-[var(--color-primary)] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(circle at 15% 20%, rgba(220,151,80,.3), transparent 30%), radial-gradient(circle at 88% 90%, rgba(255,255,255,.1), transparent 26%)",
            }}
          />

          <div className="container-page relative py-10 sm:py-14 lg:py-20">
            <nav
              aria-label="مسیر صفحه"
              className="mb-7 flex items-center gap-2 text-xs text-white/70 sm:text-sm"
            >
              <Link href="/" className="transition hover:text-white">
                خانه
              </Link>

              <span aria-hidden="true">/</span>

              <span aria-current="page" className="text-white">
                درباره ما
              </span>
            </nav>

            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:text-sm">
                  <ShoppingBag size={16} aria-hidden="true" />
                  آشنایی با برجک
                </div>

                <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                  درباره فروشگاه اینترنتی برجک
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base sm:leading-9">
                  برجک (Borjak) فروشگاه اینترنتی برای مشاهده، بررسی و
                  سفارش کالاهای متنوع، از جمله محصولات دیجیتال و پوشاک است.
                  ما با همکاری تأمین‌کنندگان مختلف تلاش می‌کنیم مسیر انتخاب
                  محصول، ثبت سفارش و پیگیری خرید را برای مشتریان ساده‌تر و
                  شفاف‌تر کنیم.
                </p>

                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/search"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)]"
                  >
                    مشاهده محصولات
                    <ArrowLeft size={17} aria-hidden="true" />
                  </Link>

                  <Link
                    href="/contact"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
                  >
                    تماس با برجک
                  </Link>
                </div>
              </div>

              <div className="hidden lg:flex lg:justify-center">
                <div className="flex h-56 w-56 items-center justify-center rounded-[2.5rem] border border-white/15 bg-white/10 shadow-2xl shadow-black/10 backdrop-blur-sm">
                  <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-[var(--color-accent)] text-white shadow-lg shadow-black/15">
                    <ShoppingBag size={64} strokeWidth={1.4} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container-page py-8 sm:py-12 lg:py-14">
          {/* Brand introduction and business model */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:gap-6">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-7 lg:p-8">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <HeartHandshake size={23} aria-hidden="true" />
              </div>

              <h2 className="text-xl font-black sm:text-2xl">
                ما که هستیم؟
              </h2>

              <div className="mt-4 space-y-4 text-sm leading-8 text-[var(--color-text-muted)] sm:text-[15px] sm:leading-9">
                <p>
                  <strong className="font-bold text-[var(--color-text)]">
                    برجک (Borjak)
                  </strong>{" "}
                  یک فروشگاه اینترنتی است که با هدف فراهم‌کردن بستری ساده
                  برای مشاهده، بررسی و سفارش کالاهای متنوع فعالیت می‌کند.
                </p>

                <p>
                  برجک با تأمین‌کنندگان مختلف همکاری می‌کند تا محصولات
                  آن‌ها در بستر فروشگاه معرفی و برای سفارش در دسترس
                  مشتریان قرار بگیرند. کالاهای عرضه‌شده ممکن است متعلق
                  به تأمین‌کنندگان همکار باشند و برجک نقش واسطه در معرفی
                  محصولات و دریافت سفارش‌ها را بر عهده دارد.
                </p>

                <p>
                  ما تلاش می‌کنیم فرایند ثبت سفارش، هماهنگی خرید و پیگیری
                  آن را برای مشتریان ساده‌تر کنیم و اطلاعات لازم درباره
                  محصولات و شرایط سفارش را در دسترس قرار دهیم.
                </p>

                <p>
                  پیشنهاد می‌کنیم پیش از ثبت سفارش، مشخصات محصول و
                  شرایط فروش، ارسال و بازگشت کالا را در صفحه محصول
                  و قوانین فروشگاه مطالعه کنید.
                </p>
              </div>
            </article>

            <aside className="flex flex-col justify-between gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:p-7">
              <div>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                  <BadgeCheck size={22} aria-hidden="true" />
                </div>

                <h2 className="text-lg font-black">
                  نگاه ما به تجربه خرید
                </h2>

                <p className="mt-3 text-sm leading-8 text-[var(--color-text-muted)]">
                  اطلاعات روشن، دسترسی آسان و امکان پیگیری سفارش؛
                  سه بخش مهم از تجربه‌ای هستند که می‌خواهیم در برجک
                  به‌مرور بهبود دهیم.
                </p>
              </div>

              <Link
                href="/rules"
                className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-accent)] transition hover:gap-3"
              >
                مطالعه قوانین و مقررات
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            </aside>
          </div>

          {/* Brand values */}
          <section className="mt-10 sm:mt-12" aria-labelledby="values-title">
            <div className="mb-5 max-w-2xl">
              <p className="text-xs font-bold tracking-wide text-[var(--color-accent)] sm:text-sm">
                آنچه برای ما اهمیت دارد
              </p>

              <h2
                id="values-title"
                className="mt-2 text-xl font-black sm:text-2xl"
              >
                ارزش‌های برجک
              </h2>

              <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                این اصول راهنمای ما برای بهتر کردن تجربه مشتریان هستند.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {values.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[var(--color-accent)]/60 hover:shadow-md sm:p-6"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Icon size={22} aria-hidden="true" />
                  </div>

                  <h3 className="font-black">{title}</h3>

                  <p className="mt-2 text-sm leading-8 text-[var(--color-text-muted)]">
                    {text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Purchase process */}
          <section
            className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:mt-12 sm:p-7"
            aria-labelledby="purchase-process-title"
          >
            <div className="mb-6 max-w-2xl">
              <p className="text-xs font-bold text-[var(--color-accent)] sm:text-sm">
                از انتخاب تا پیگیری
              </p>

              <h2
                id="purchase-process-title"
                className="mt-2 text-xl font-black sm:text-2xl"
              >
                فرایند خرید در برجک
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <article
                  key={step.number}
                  className="rounded-xl bg-[var(--color-bg)] p-4 sm:p-5"
                >
                  <span className="text-sm font-black text-[var(--color-accent)]">
                    {step.number}
                  </span>

                  <h3 className="mt-2 font-bold">{step.title}</h3>

                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* Call to action */}
          <section className="mt-8 flex flex-col gap-4 rounded-2xl bg-[var(--color-primary)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-3">
              <Truck
                size={23}
                className="mt-1 shrink-0 text-[var(--color-accent-light)]"
                aria-hidden="true"
              />

              <div>
                <h2 className="font-black">
                  برای شروع آماده‌اید؟
                </h2>

                <p className="mt-1 text-sm leading-7 text-white/75">
                  محصولات را بررسی کنید یا برای راهنمایی بیشتر با ما
                  در تماس باشید.
                </p>
              </div>
            </div>

            <Link
              href="/search"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)]"
            >
              رفتن به فروشگاه
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
          </section>
        </section>
      </main>

      <Footer />
    </div>
  );
}
