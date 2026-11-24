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
  title: "درباره ما | برجک",
  description: "با فروشگاه اینترنتی برجک، شیوه فعالیت و ارزش‌های ما آشنا شوید.",
};

const values = [
  {
    icon: Search,
    title: "انتخاب آگاهانه",
    text: "تلاش می‌کنیم اطلاعات محصولات و مشخصات آن‌ها به شکلی روشن در اختیار شما باشد تا بتوانید با آگاهی بیشتری انتخاب کنید.",
  },
  {
    icon: ShieldCheck,
    title: "شفافیت در خرید",
    text: "نمایش جزئیات سفارش و ارائه اطلاعات روشن، بخش مهمی از تجربه خریدی قابل‌اعتماد است.",
  },
  {
    icon: Headphones,
    title: "همراهی با مشتری",
    text: "ارتباط با مشتریان برای پاسخ‌گویی به پرسش‌ها و پیگیری بهتر سفارش‌ها اهمیت دارد.",
  },
];

const steps = [
  { number: "۰۱", title: "بررسی محصولات", text: "محصولات و دسته‌بندی‌ها را ببینید و مشخصات موردنظر خود را بررسی کنید." },
  { number: "۰۲", title: "ثبت سفارش", text: "گزینه مناسب را انتخاب کنید و اطلاعات لازم برای ثبت سفارش را وارد کنید." },
  { number: "۰۳", title: "پیگیری سفارش", text: "وضعیت سفارش خود را از طریق حساب کاربری دنبال کنید و در صورت نیاز با ما تماس بگیرید." },
];

export default function AboutPage() {
  return (
    <div dir="rtl" className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Header />

      <main>
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
            <div className="mb-7 flex items-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="transition hover:text-white">خانه</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white">درباره ما</span>
            </div>

            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12">
              <div className="max-w-3xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:text-sm">
                  <ShoppingBag size={16} />
                  آشنایی با برجک
                </div>
                <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                  خریدی ساده‌تر، با انتخابی آگاهانه‌تر
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base sm:leading-9">
                  برجک با هدف ساده‌تر کردن فرایند بررسی و سفارش کالا راه‌اندازی شده است. تلاش می‌کنیم دسترسی به محصولات متنوع، اطلاعات روشن و مسیر پیگیری سفارش را برای مشتریان آسان‌تر کنیم.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/search"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)]"
                  >
                    مشاهده محصولات
                    <ArrowLeft size={17} />
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
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:gap-6">
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-7 lg:p-8">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                <HeartHandshake size={23} />
              </div>
              <h2 className="text-xl font-black sm:text-2xl">ما که هستیم؟</h2>
              <div className="mt-4 space-y-4 text-sm leading-8 text-[var(--color-text-muted)] sm:text-[15px] sm:leading-9">
                <p>
                  فروشگاه اینترنتی <strong className="font-bold text-[var(--color-text)]">برجک</strong> با هدف فراهم کردن تجربه‌ای ساده و قابل‌فهم برای بررسی و سفارش کالا فعالیت می‌کند.
                </p>
                <p>
                  باور داریم خرید اینترنتی زمانی رضایت‌بخش‌تر است که مشتری بتواند محصولات را مقایسه کند، مشخصات را بخواند و از مراحل سفارش خود آگاهی داشته باشد.
                </p>
                <p>
                  به همین دلیل، تلاش می‌کنیم مسیر انتخاب محصول، ثبت سفارش و ارتباط با پشتیبانی تا حد امکان روشن و روان باشد.
                </p>
              </div>
            </article>

            <aside className="flex flex-col justify-between gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:p-7">
              <div>
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                  <BadgeCheck size={22} />
                </div>
                <h2 className="text-lg font-black">نگاه ما به تجربه خرید</h2>
                <p className="mt-3 text-sm leading-8 text-[var(--color-text-muted)]">
                  اطلاعات روشن، دسترسی آسان و امکان پیگیری؛ سه بخش مهم از تجربه‌ای هستند که می‌خواهیم در برجک بهبود دهیم.
                </p>
              </div>
              <Link href="/rules" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--color-accent)] transition hover:gap-3">
                مطالعه قوانین و مقررات
                <ArrowLeft size={16} />
              </Link>
            </aside>
          </div>

          <div className="mt-10 sm:mt-12">
            <div className="mb-5 max-w-2xl">
              <p className="text-xs font-bold tracking-wide text-[var(--color-accent)] sm:text-sm">آنچه برای ما اهمیت دارد</p>
              <h2 className="mt-2 text-xl font-black sm:text-2xl">ارزش‌های برجک</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">این اصول راهنمای ما برای بهتر کردن تجربه مشتریان هستند.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {values.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:-translate-y-1 hover:border-[var(--color-accent)]/60 hover:shadow-md sm:p-6">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                    <Icon size={22} />
                  </div>
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-8 text-[var(--color-text-muted)]">{text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:mt-12 sm:p-7">
            <div className="mb-6 max-w-2xl">
              <p className="text-xs font-bold text-[var(--color-accent)] sm:text-sm">از انتخاب تا پیگیری</p>
              <h2 className="mt-2 text-xl font-black sm:text-2xl">فرایند خرید در برجک</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="rounded-xl bg-[var(--color-bg)] p-4 sm:p-5">
                  <span className="text-sm font-black text-[var(--color-accent)]">{step.number}</span>
                  <h3 className="mt-2 font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl bg-[var(--color-primary)] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div className="flex items-start gap-3">
              <Truck size={23} className="mt-1 shrink-0 text-[var(--color-accent-light)]" />
              <div>
                <h2 className="font-black">برای شروع آماده‌اید؟</h2>
                <p className="mt-1 text-sm leading-7 text-white/75">محصولات را بررسی کنید یا برای راهنمایی بیشتر با ما در تماس باشید.</p>
              </div>
            </div>
            <Link href="/search" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-accent-hover)]">
              رفتن به فروشگاه
              <ArrowLeft size={17} />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
