
import Image from "next/image";
import {
  Download,
  Smartphone,
  ShieldCheck,
  Share2,
  Plus,
  CheckCircle2,
} from "lucide-react";

export const metadata = {
  title: "نصب اپلیکیشن برجک",
  description:
    "دانلود مستقیم اپلیکیشن اندروید برجک و راهنمای نصب آن روی گوشی‌های اندروید و آیفون.",
  alternates: {
    canonical: "/install",
  },
};

export default function InstallAppPage() {
  return (
    <div className="container-page py-6 sm:py-10" dir="rtl">
      {/* Introduction */}
      <section className="relative overflow-hidden rounded-3xl bg-[#1e2640] px-5 py-8 text-white shadow-lg sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#dc9750]/20 blur-3xl"
        />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 text-center sm:flex-row sm:text-right">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 p-3 sm:h-36 sm:w-36">
            <Image
              src="/images/logo3.png"
              alt="اپلیکیشن برجک"
              width={144}
              height={144}
              priority
              className="h-full w-full rounded-2xl object-contain"
            />
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-orange-200">
              <Smartphone size={15} />
              اپلیکیشن رسمی برجک
            </span>

            <h1 className="mt-4 text-2xl font-black leading-relaxed sm:text-3xl">
              برجک، همیشه همراه شما
            </h1>

            <p className="mt-3 text-sm leading-8 text-white/75">
              با نصب اپلیکیشن برجک، سریع‌تر به فروشگاه دسترسی داشته
              باشید و تجربه راحت‌تری از مشاهده محصولات و ثبت سفارش
              داشته باشید.
            </p>

            <a
              href="/downloads/borjak.apk"
              download="Borjak.apk"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#dc9750] px-6 py-3.5 text-sm font-bold text-[#1e2640] shadow-md transition hover:bg-[#e6a968] active:scale-[0.98] sm:w-auto"
            >
              <Download size={20} />
              دانلود اپلیکیشن اندروید
            </a>

            <p className="mt-3 text-xs leading-6 text-white/50">
              دانلود مستقیم فایل نصب از وب‌سایت رسمی برجک
            </p>
          </div>
        </div>
      </section>

      {/* Android instructions */}
      <section className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <Smartphone size={23} />
          </div>

          <div>
            <h2 className="text-lg font-bold">
              راهنمای نصب در اندروید
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              نصب اپلیکیشن با فایل APK
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-5">
          {[
            {
              title: "دانلود فایل نصب",
              description:
                "روی دکمه دانلود اپلیکیشن برجک بزنید تا فایل APK دریافت شود.",
            },
            {
              title: "باز کردن فایل",
              description:
                "پس از دانلود، فایل Borjak.apk را از قسمت دانلودهای گوشی باز کنید.",
            },
            {
              title: "تأیید نصب",
              description:
                "در صورت درخواست اندروید، اجازه نصب برنامه از مرورگر یا مدیر فایل را فعال کنید و نصب را ادامه دهید.",
            },
            {
              title: "اجرای برجک",
              description:
                "پس از پایان نصب، آیکون برجک در فهرست برنامه‌های گوشی شما قرار می‌گیرد.",
            },
          ].map((step, index) => (
            <div key={step.title} className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-sm font-bold text-[var(--color-accent)]">
                {index + 1}
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-7 text-[var(--color-text-muted)]">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-2 rounded-xl bg-[var(--color-surface-2)] p-3">
          <ShieldCheck
            size={19}
            className="mt-0.5 shrink-0 text-green-600"
          />
          <p className="text-xs leading-6 text-[var(--color-text-muted)]">
            فایل نصب را فقط از وب‌سایت رسمی برجک دریافت کنید.
          </p>
        </div>
      </section>

      {/* iOS instructions */}
      <section className="mt-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            <Share2 size={22} />
          </div>

          <div>
            <h2 className="text-lg font-bold">
              استفاده در آیفون
            </h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              افزودن نسخه وب برجک به صفحه اصلی
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-7 text-[var(--color-text-muted)]">
          در آیفون نیازی به دانلود فایل APK نیست. می‌توانید وب‌سایت
          برجک را از طریق مرورگر Safari به صفحه اصلی گوشی اضافه کنید.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] p-4">
            <Share2
              size={21}
              className="shrink-0 text-[var(--color-accent)]"
            />
            <p className="text-sm leading-6">
              ۱. در Safari روی دکمه Share بزنید.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-2)] p-4">
            <Plus
              size={21}
              className="shrink-0 text-[var(--color-accent)]"
            />
            <p className="text-sm leading-6">
              ۲. گزینه Add to Home Screen را انتخاب کنید.
            </p>
          </div>
        </div>
      </section>

      {/* Final note */}
      <div className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-[var(--color-text-muted)]">
        <CheckCircle2 size={17} className="shrink-0 text-green-600" />
        <span>
          از همراهی شما با فروشگاه اینترنتی برجک سپاسگزاریم.
        </span>
      </div>
    </div>
  );
}
