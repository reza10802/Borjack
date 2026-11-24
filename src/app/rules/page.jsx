import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
  title: "قوانین و مقررات | برجک",
  description: "قوانین و شرایط استفاده از فروشگاه اینترنتی برجک",
};

const sections = [
  {
    id: "acceptance",
    title: "پذیرش قوانین",
    body: "ورود کاربران به وب‌سایت برجک و ثبت سفارش، به منزله مطالعه، آگاهی و پذیرش کامل قوانین و مقررات فروشگاه است.",
  },
  {
    id: "orders",
    title: "ثبت سفارش",
    body: "ثبت سفارش تنها پس از پرداخت موفق یا انتخاب روش پرداخت معتبر نهایی خواهد بود. فروشگاه حق لغو سفارش‌هایی که به علت خطا در قیمت، موجودی یا مشکلات فنی ثبت شده‌اند را دارد.",
  },
  {
    id: "prices",
    title: "قیمت کالاها",
    body: "تمام قیمت‌ها به ریال درج شده‌اند و ممکن است بدون اطلاع قبلی تغییر کنند. قیمت نهایی سفارش، مبلغ ثبت‌شده در زمان تکمیل خرید خواهد بود.",
  },
  {
    id: "shipping",
    title: "ارسال سفارش",
    body: "سفارش‌ها پس از آماده‌سازی از طریق شرکت‌های حمل‌ونقل معتبر ارسال می‌شوند. مدت زمان تحویل بسته به شهر مقصد و شرایط شرکت حمل متفاوت خواهد بود.",
  },
  {
    id: "authenticity",
    title: "اصالت کالا",
    body: "برجک اصالت تمامی کالاهای عرضه‌شده را تضمین می‌کند و تلاش دارد محصولات مطابق مشخصات اعلام‌شده به دست مشتری برسند.",
  },
  {
    id: "user-responsibility",
    title: "مسئولیت کاربران",
    body: "کاربران موظف هستند اطلاعات صحیح و کامل شامل نام، شماره تماس، آدرس و کدپستی را ثبت کنند. مسئولیت هرگونه مغایرت اطلاعات بر عهده کاربر خواهد بود.",
  },
  {
    id: "cancellation",
    title: "لغو سفارش",
    body: "امکان لغو سفارش تنها تا پیش از آماده‌سازی و ارسال کالا وجود دارد. پس از تحویل بسته به شرکت حمل، لغو سفارش امکان‌پذیر نخواهد بود.",
  },
  {
    id: "privacy",
    title: "حفظ اطلاعات کاربران",
    body: "اطلاعات شخصی کاربران نزد فروشگاه محرمانه بوده و مطابق قوانین جمهوری اسلامی ایران نگهداری می‌شود و در اختیار اشخاص ثالث قرار نخواهد گرفت؛ مگر در موارد قانونی.",
  },
  {
    id: "updates",
    title: "تغییر قوانین",
    body: "برجک می‌تواند در هر زمان نسبت به اصلاح یا بروزرسانی قوانین اقدام کند. نسخه منتشرشده در وب‌سایت، معتبرترین نسخه خواهد بود.",
  },
];

export default function RulesPage() {
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
                "radial-gradient(circle at 12% 15%, rgba(220,151,80,.28), transparent 30%), radial-gradient(circle at 90% 85%, rgba(255,255,255,.10), transparent 28%)",
            }}
          />
          <div className="container-page relative py-10 sm:py-14 lg:py-16">
            <div className="mb-7 flex items-center gap-2 text-xs text-white/70 sm:text-sm">
              <Link href="/" className="transition hover:text-white">خانه</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white">قوانین و مقررات</span>
            </div>

            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:text-sm">
                <BookOpen size={16} />
                راهنمای استفاده از برجک
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                قوانین و مقررات
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base sm:leading-9">
                برای تجربه خریدی روشن و مطمئن، شرایط استفاده از فروشگاه و ثبت سفارش را مرور کنید.
              </p>
            </div>
          </div>
        </section>

        <section className="container-page py-8 sm:py-12">
          <div className="mb-7 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 className="font-bold">پیش از ثبت سفارش، این موارد را بخوانید</h2>
              <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">
                موضوعات مهم را از فهرست زیر انتخاب کنید یا همه بندها را به‌ترتیب مطالعه کنید.
              </p>
            </div>
          </div>

          <nav aria-label="فهرست قوانین" className="mb-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <ClipboardList size={18} className="text-[var(--color-accent)]" />
              فهرست مطالب
            </div>
            <div className="flex flex-wrap gap-2">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] sm:text-sm"
                >
                  <span className="font-bold text-[var(--color-accent)]">{index + 1}</span>
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {sections.map((section, index) => (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-32 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:border-[var(--color-accent)]/50 hover:shadow-md sm:p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-sm font-black text-[var(--color-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-base font-black sm:text-lg">{section.title}</h2>
                </div>
                <p className="text-sm leading-8 text-[var(--color-text-muted)] sm:text-[15px] sm:leading-9">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="mt-1 shrink-0 text-[var(--color-accent)]" size={21} />
              <div>
                <h2 className="font-bold">پرسشی درباره قوانین دارید؟</h2>
                <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">
                  برای دریافت راهنمایی بیشتر با تیم برجک در ارتباط باشید.
                </p>
              </div>
            </div>
            <Link
              href="/contact"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-3 text-sm font-bold text-white transition hover:bg-[var(--color-primary-hover)]"
            >
              ارتباط با ما
              <ArrowLeft size={17} />
            </Link>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-6 text-[var(--color-text-muted)]">
            <CheckCircle2 size={15} className="text-[var(--color-accent)]" />
            از اعتماد شما به فروشگاه برجک سپاسگزاریم.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
