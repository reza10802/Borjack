export const metadata = {
  title: "ارتباط با ما | برجک",
  description: "تماس با فروشگاه اینترنتی برجک",
};

export default function ContactPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--background-app)]"
    >
      {/* Hero */}
      <section className="bg-[var(--color-primary)] text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl font-black mb-5">
            ارتباط با ما
          </h1>

          <p className="text-lg opacity-90 max-w-3xl mx-auto leading-9">
            اگر سوال، پیشنهاد یا انتقادی دارید، خوشحال می‌شویم با ما در ارتباط باشید.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">

        <div className="grid lg:grid-cols-2 gap-8">

          {/* اطلاعات تماس */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800">

            <h2 className="text-2xl font-black mb-8 text-[var(--color-primary)] dark:text-white">
              اطلاعات تماس
            </h2>

            <div className="space-y-6">

              <div>
                <p className="font-bold text-zinc-800 dark:text-white mb-1">
                  شماره تماس
                </p>

                <p className="text-zinc-600 dark:text-zinc-300">
                  09038775616
                </p>
              </div>

              <div>
                <p className="font-bold text-zinc-800 dark:text-white mb-1">
                  موبایل
                </p>

                <p className="text-zinc-600 dark:text-zinc-300">
                  09116001260
                </p>
              </div>

              <div>
                <p className="font-bold text-zinc-800 dark:text-white mb-1">
                  ایمیل
                </p>

                <p className="text-zinc-600 dark:text-zinc-300">
                  reza.nedae8080@gmail.com
                </p>
              </div>

              <div>
                <p className="font-bold text-zinc-800 dark:text-white mb-1">
                  ساعات پاسخگویی
                </p>

                <p className="text-zinc-600 dark:text-zinc-300">
                  شنبه تا پنجشنبه
                  <br />
                  ۹ صبح تا ۱۸ عصر
                </p>
              </div>

              <div>
                <p className="font-bold text-zinc-800 dark:text-white mb-1">
                  آدرس
                </p>

                <p className="text-zinc-600 dark:text-zinc-300 leading-8">
                  تهران، میدان خراسان
                </p>
              </div>

            </div>

          </div>

          {/* فرم تماس */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-100 dark:border-zinc-800">

            <h2 className="text-2xl font-black mb-8 text-[var(--color-primary)] dark:text-white">
              ارسال پیام
            </h2>

            <form className="space-y-5">

              <input
                type="text"
                placeholder="نام و نام خانوادگی"
                className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
              />

              <input
                type="text"
                placeholder="شماره تماس"
                className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
              />

              <input
                type="email"
                placeholder="ایمیل (اختیاری)"
                className="w-full h-12 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4"
              />

              <textarea
                rows={6}
                placeholder="متن پیام..."
                className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-4 resize-none"
              />

              <button
                type="submit"
                className="btn-primary w-full h-12 rounded-2xl font-bold"
              >
                ارسال پیام
              </button>

            </form>

          </div>

        </div>

      </section>
    </div>
  );
}