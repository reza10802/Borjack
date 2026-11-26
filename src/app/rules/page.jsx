
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
  title: "قوانین و مقررات",
  description:
    "قوانین و شرایط استفاده از فروشگاه اینترنتی برجک (Borjak)، ثبت سفارش، پرداخت، ارسال، انصراف از خرید و حفظ اطلاعات کاربران.",
  alternates: {
    canonical: "/rules",
  },
  openGraph: {
    type: "website",
    title: "قوانین و مقررات | برجک",
    description:
      "مطالعه شرایط استفاده از فروشگاه اینترنتی برجک، ثبت سفارش، پرداخت، ارسال و حقوق مشتریان.",
    url: "/rules",
    siteName: "برجک",
    locale: "fa_IR",
  },
};

const sections = [
  {
    id: "acceptance",
    title: "پذیرش قوانین",
    body:
      "استفاده از خدمات فروشگاه اینترنتی برجک و ثبت سفارش به معنای پذیرش شرایط استفاده از فروشگاه است. مشتریان پیش از نهایی‌کردن سفارش باید اطلاعات محصول، قیمت، هزینه‌های جانبی، شرایط ارسال و مقررات مربوط به انصراف و بازگشت کالا را مطالعه کنند. هیچ‌یک از مفاد این قوانین، حقوقی را که طبق قوانین لازم‌الاجرا برای مصرف‌کننده در نظر گرفته شده است، محدود نمی‌کند.",
  },
  {
    id: "business-model",
    title: "شیوه فعالیت برجک",
    body:
      "برجک (Borjak) یک فروشگاه اینترنتی است که با تأمین‌کنندگان مختلف همکاری می‌کند. محصولات همکاران در بستر فروشگاه معرفی می‌شوند و مشتریان می‌توانند از طریق برجک سفارش خود را ثبت و فرایند خرید را پیگیری کنند. برخی کالاهای عرضه‌شده ممکن است متعلق به تأمین‌کنندگان همکار باشند. همکاری با تأمین‌کنندگان به‌خودی‌خود موجب سلب حقوق قانونی مشتری یا مسئولیت‌های مقرر برای اشخاص مسئول عرضه کالا نمی‌شود.",
  },
  {
    id: "supplier-information",
    title: "اطلاعات تأمین‌کنندگان و محصولات",
    body:
      "مشخصات فنی، ویژگی‌ها، قیمت، وضعیت موجودی، شرایط ضمانت و خدمات پس از فروش هر کالا باید پیش از خرید در صفحه محصول یا اطلاعات تکمیلی سفارش در دسترس مشتری قرار گیرد. اطلاعات هویتی و راه ارتباطی تأمین‌کننده یا فروشنده نیز باید مطابق الزامات قانونی در اختیار مشتری قرار گیرد. مشتریان می‌توانند پیش از پرداخت، اطلاعات محصول و شرایط اختصاصی آن را بررسی کنند.",
  },
  {
    id: "orders",
    title: "ثبت و تأیید سفارش",
    body:
      "ثبت سفارش پس از تکمیل اطلاعات موردنیاز و تأیید پرداخت یا روش پرداخت ارائه‌شده در فروشگاه انجام می‌شود. ثبت اولیه سفارش به‌تنهایی به معنای تأیید نهایی موجودی کالا نیست. در صورت ناموجودبودن کالا یا عدم امکان انجام سفارش، موضوع به مشتری اطلاع داده می‌شود و مبلغ دریافتی مطابق مقررات مربوط مسترد خواهد شد؛ مگر اینکه مشتری با راهکار جایگزین یا زمان تحویل جدید موافقت کند.",
  },
  {
    id: "prices",
    title: "قیمت کالاها و هزینه‌های جانبی",
    body:
      "قیمت هر محصول و هزینه‌های مرتبط با سفارش، از جمله هزینه ارسال و سایر مبالغ قابل پرداخت، باید پیش از نهایی‌کردن خرید به مشتری نمایش داده شود. مبلغ قابل پرداخت، مبلغ تأییدشده در مرحله نهایی سفارش است. در صورت مشاهده خطای مؤثر در قیمت یا اطلاعات سفارش، پیش از نهایی‌سازی موضوع به مشتری اطلاع داده می‌شود و در صورت پرداخت قبلی، وجوه دریافتی مطابق مقررات مسترد خواهد شد.",
  },
  {
    id: "shipping",
    title: "ارسال و تحویل سفارش",
    body:
      "سفارش‌ها پس از تأیید و آماده‌سازی، از طریق روش ارسال انتخاب‌شده در زمان خرید به نشانی ثبت‌شده مشتری ارسال می‌شوند. هزینه و اطلاعات مربوط به روش ارسال باید پیش از پرداخت مشخص باشد. زمان تحویل با توجه به شهر مقصد، زمان آماده‌سازی کالا و عملکرد شرکت حمل‌ونقل ممکن است متفاوت باشد. مشتری موظف است نشانی، شماره تماس و کدپستی را به‌درستی ثبت کند.",
  },
  {
    id: "product-quality",
    title: "مشخصات، اصالت و ضمانت کالا",
    body:
      "اطلاعات مربوط به برند، مدل، مشخصات فنی، لوازم همراه، وضعیت کالا و شرایط ضمانت باید مطابق اطلاعات ارائه‌شده برای همان محصول باشد. شرایط گارانتی و خدمات پس از فروش، در صورت وجود، بر اساس اطلاعات اعلام‌شده برای محصول و ضمانت‌کننده مربوط تعیین می‌شود. در صورت دریافت کالای مغایر با سفارش، معیوب یا دارای ایراد، مشتری می‌تواند از طریق راه‌های ارتباطی برجک موضوع را پیگیری کند. حقوق قانونی مشتری در زمینه صحت و سلامت کالا محفوظ است.",
  },
  {
    id: "cancellation",
    title: "لغو سفارش و حق انصراف",
    body:
      "مشتری می‌تواند پیش از تحویل سفارش به شرکت حمل‌ونقل، درخواست لغو سفارش را از طریق پشتیبانی ثبت کند تا وضعیت سفارش بررسی شود. علاوه بر این، در معاملات از راه دور، حق انصراف مصرف‌کننده طبق قوانین لازم‌الاجرا و اصولاً با مهلت حداقل هفت روز کاری برقرار است. برای خرید کالا، مبدأ این مهلت مطابق قانون از زمان تحویل کالا به مصرف‌کننده محاسبه می‌شود. استفاده از این حق نیازمند ارائه دلیل یا پرداخت جریمه نیست و هزینه بازپس‌فرستادن کالا طبق ضوابط قانونی خواهد بود. موارد استثنای حق انصراف نیز تابع قوانین و آیین‌نامه‌های مربوط است.",
  },
  {
    id: "returns",
    title: "مغایرت، ایراد و بازگشت کالا",
    body:
      "اگر کالای تحویل‌شده با سفارش ثبت‌شده مغایرت داشته باشد، کالای دیگری ارسال شده باشد یا کالا دارای عیب و نقص باشد، مشتری باید موضوع را از طریق پشتیبانی برجک اطلاع دهد. نحوه بررسی، تعویض، بازگشت کالا و پرداخت هزینه‌های مربوط با توجه به نوع ایراد، شرایط ضمانت و قوانین حمایت از حقوق مصرف‌کننده تعیین می‌شود. شرایط بازگشت کالا نباید موجب سلب حقوق قانونی مشتری شود.",
  },
  {
    id: "user-responsibility",
    title: "مسئولیت اطلاعات کاربران",
    body:
      "کاربران موظف هستند هنگام ثبت سفارش، اطلاعات صحیح و کامل شامل نام، شماره تلفن، نشانی و کدپستی را وارد کنند. مسئولیت مشکلات ناشی از ثبت اطلاعات اشتباه یا ناقص، در حدودی که ناشی از عملکرد کاربر باشد، بر عهده او خواهد بود. اطلاعات سفارش باید برای امکان تحویل صحیح کالا قابل استفاده باشد.",
  },
  {
    id: "privacy",
    title: "حفظ حریم خصوصی و اطلاعات کاربران",
    body:
      "برجک اطلاعات موردنیاز کاربران را برای ایجاد و مدیریت حساب کاربری، ثبت و پیگیری سفارش، پردازش پرداخت و ارائه خدمات پشتیبانی جمع‌آوری و پردازش می‌کند. در صورت نیاز، اطلاعات ضروری سفارش در حد لازم با تأمین‌کننده مربوط، شرکت ارائه‌دهنده خدمات پرداخت و شرکت حمل‌ونقل به اشتراک گذاشته می‌شود. اطلاعات کاربران برای اهداف نامرتبط یا تبلیغات بدون رعایت الزامات قانونی استفاده نخواهد شد. درخواست اصلاح اطلاعات یا پیگیری درباره نحوه استفاده از آن‌ها از طریق راه‌های ارتباطی فروشگاه قابل ثبت است. نگهداری سوابق نیز تابع الزامات قانونی مربوط خواهد بود.",
  },
  {
    id: "updates",
    title: "تغییر و به‌روزرسانی قوانین",
    body:
      "برجک ممکن است برای بهبود خدمات یا هماهنگی با تغییرات قانونی، این مقررات را به‌روزرسانی کند. نسخه جدید از زمان انتشار در وب‌سایت قابل مشاهده خواهد بود. تغییرات جدید نباید حقوق قانونی مشتریان یا تعهدات ایجادشده در سفارش‌های قبلی را نقض کند.",
  },
];

export default function RulesPage() {
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
                "radial-gradient(circle at 12% 15%, rgba(220,151,80,.28), transparent 30%), radial-gradient(circle at 90% 85%, rgba(255,255,255,.10), transparent 28%)",
            }}
          />

          <div className="container-page relative py-10 sm:py-14 lg:py-16">
            <nav
              aria-label="مسیر صفحه"
              className="mb-7 flex items-center gap-2 text-xs text-white/70 sm:text-sm"
            >
              <Link href="/" className="transition hover:text-white">
                خانه
              </Link>

              <span aria-hidden="true">/</span>

              <span aria-current="page" className="text-white">
                قوانین و مقررات
              </span>
            </nav>

            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 sm:text-sm">
                <BookOpen size={16} aria-hidden="true" />
                راهنمای استفاده از برجک
              </div>

              <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">
                قوانین و مقررات فروشگاه برجک
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/80 sm:text-base sm:leading-9">
                شرایط استفاده از فروشگاه، ثبت سفارش، پرداخت، ارسال و
                حقوق مشتریان را پیش از خرید مطالعه کنید.
              </p>
            </div>
          </div>
        </section>

        <section className="container-page py-8 sm:py-12">
          {/* Intro */}
          <div className="mb-7 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:flex-row sm:items-center sm:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>

            <div>
              <h2 className="font-bold">
                پیش از ثبت سفارش، این موارد را بخوانید
              </h2>

              <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">
                اطلاعات محصول، هزینه‌های خرید، شرایط ارسال و ضوابط بازگشت
                کالا را پیش از پرداخت بررسی کنید.
              </p>
            </div>
          </div>

          {/* Table of contents */}
          <nav
            aria-label="فهرست قوانین"
            className="mb-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
          >
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <ClipboardList
                size={18}
                className="text-[var(--color-accent)]"
                aria-hidden="true"
              />
              فهرست مطالب
            </div>

            <div className="flex flex-wrap gap-2">
              {sections.map((section, index) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] sm:text-sm"
                >
                  <span className="font-bold text-[var(--color-accent)]">
                    {index + 1}
                  </span>
                  {section.title}
                </a>
              ))}
            </div>
          </nav>

          {/* Rules */}
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {sections.map((section, index) => (
              <article
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-title`}
                className="scroll-mt-32 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm transition hover:border-[var(--color-accent)]/50 hover:shadow-md sm:p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-sm font-black text-[var(--color-accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h2
                    id={`${section.id}-title`}
                    className="text-base font-black sm:text-lg"
                  >
                    {section.title}
                  </h2>
                </div>

                <p className="text-sm leading-8 text-[var(--color-text-muted)] sm:text-[15px] sm:leading-9">
                  {section.body}
                </p>
              </article>
            ))}
          </div>

          {/* Contact */}
          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <MessageCircle
                className="mt-1 shrink-0 text-[var(--color-accent)]"
                size={21}
                aria-hidden="true"
              />

              <div>
                <h2 className="font-bold">
                  پرسشی درباره قوانین دارید؟
                </h2>

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
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs leading-6 text-[var(--color-text-muted)]">
            <CheckCircle2
              size={15}
              className="text-[var(--color-accent)]"
              aria-hidden="true"
            />
            از اعتماد شما به فروشگاه برجک سپاسگزاریم.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
}
