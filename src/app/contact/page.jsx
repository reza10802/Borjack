import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "ارتباط با ما | برجک",
  description: "راه‌های تماس با فروشگاه اینترنتی برجک و دریافت راهنمایی درباره سفارش‌ها",
};

const contacts = [
  {
    icon: Phone,
    title: "تماس تلفنی",
    detail: "09038775616",
    href: "tel:09038775616",
    action: "تماس با این شماره",
  },
  {
    icon: Phone,
    title: "شماره تماس دوم",
    detail: "09116001260",
    href: "tel:09116001260",
    action: "تماس با این شماره",
  },
  {
    icon: Mail,
    title: "ایمیل",
    detail: "reza.nedae8080@gmail.com",
    href: "mailto:reza.nedae8080@gmail.com",
    action: "ارسال ایمیل",
  },
  {
    icon: MapPin,
    title: "نشانی",
    detail: "تهران، میدان خراسان",
    href: null,
    action: null,
  },
];

export default function ContactPage() {
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
                "radial-gradient(circle at 13% 20%, rgba(220,151,80,.3), transparent 30%), radial-gradient(circle at 90% 85%, rgba(255,255,255,.1), transparent 27%)",
            }}
          />
          <div className="container-page relative py-10 sm:py-14 lg:py-16">
            <div className="mb-7 flex items-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="transition hover:text-white">خانه</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white">ارتباط با ما</span>
            </div>
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:text-sm">
                <MessageCircle size={16} />
                همراه شما هستیم
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">ارتباط با برجک</h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base sm:leading-9">
                برای پرسش درباره محصولات، سفارش‌ها یا ارائه پیشنهاد، از راه‌های ارتباطی زیر با ما در تماس باشید.
              </p>
            </div>
          </div>
        </section>

        <section className="container-page py-8 sm:py-12 lg:py-14">
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] lg:gap-7">
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-black sm:text-2xl">راه‌های ارتباطی</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">روش مناسب خود را انتخاب کنید تا مستقیم با ما در ارتباط باشید.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                {contacts.map(({ icon: Icon, title, detail, href, action }) => (
                  <article key={title} className="flex min-h-40 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:border-[var(--color-accent)]/60 hover:shadow-md sm:p-6">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      <Icon size={22} />
                    </div>
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 break-words text-sm leading-7 text-[var(--color-text-muted)]">{detail}</p>
                    {href && (
                      <a href={href} className="mt-auto inline-flex items-center gap-2 pt-4 text-sm font-bold text-[var(--color-accent)] transition hover:gap-3">
                        {action}
                        <ArrowLeft size={16} />
                      </a>
                    )}
                  </article>
                ))}
              </div>
            </div>

            <aside className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white">
                <Clock3 size={22} />
              </div>
              <h2 className="text-lg font-black">ساعات پاسخگویی</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">در روزها و ساعت‌های زیر می‌توانید برای دریافت پاسخ با ما تماس بگیرید.</p>

              <div className="mt-5 divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="text-[var(--color-text-muted)]">روزهای پاسخگویی</span>
                  <strong>شنبه تا پنجشنبه</strong>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="text-[var(--color-text-muted)]">ساعت پاسخگویی</span>
                  <strong dir="ltr">09:00 – 18:00</strong>
                </div>
              </div>

              <div className="mt-5 rounded-xl bg-[var(--color-surface-2)] p-4">
                <p className="text-sm font-bold">پیگیری سفارش</p>
                <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">
                  برای پیگیری سریع‌تر، هنگام تماس شماره سفارش و شماره موبایلی را که با آن خرید کرده‌اید آماده داشته باشید.
                </p>
              </div>

              <a
                href="mailto:reza.nedae8080@gmail.com?subject=%D8%A7%D8%B1%D8%AA%D8%A8%D8%A7%D8%B7%20%D8%A8%D8%A7%20%D8%A8%D8%B1%D8%AC%DA%A9"
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
              >
                ارسال پیام از طریق ایمیل
                <ArrowLeft size={17} />
              </a>
            </aside>
          </div>

          <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h2 className="font-bold">هنوز سؤال دیگری دارید؟</h2>
              <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">می‌توانید محصولات را بررسی کنید یا شرایط استفاده از فروشگاه را مطالعه کنید.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/search" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">مشاهده محصولات</Link>
              <Link href="/rules" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-bold transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">قوانین و مقررات</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
