export const metadata = {
    title: "درباره ما | برجک",
    description: "آشنایی با فروشگاه اینترنتی برجک",
};

export default function AboutPage() {
    return (
        <div
            dir="rtl"
            className="min-h-screen bg-[var(--background-app)]"
        >
            {/* Hero */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-800)] text-white">
                <div className="max-w-6xl mx-auto px-6 py-20 text-center">
                    <h1 className="text-4xl font-black mb-5">
                        درباره فروشگاه برجک
                    </h1>

                    <p className="text-lg opacity-90 max-w-3xl mx-auto leading-9">
                        ما تلاش می‌کنیم خرید اینترنتی را ساده، سریع، امن و لذت‌بخش کنیم.
                    </p>
                    <div className="mt-10 flex justify-center gap-6 flex-wrap">

                        <div className="bg-white/10 backdrop-blur rounded-2xl px-6 py-4">
                            <div className="text-2xl font-black">1000+</div>
                            <div className="text-sm opacity-80">
                                محصول
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur rounded-2xl px-6 py-4">
                            <div className="text-2xl font-black">500+</div>
                            <div className="text-sm opacity-80">
                                مشتری
                            </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur rounded-2xl px-6 py-4">
                            <div className="text-2xl font-black">24/7</div>
                            <div className="text-sm opacity-80">
                                پشتیبانی
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            <section className="max-w-6xl mx-auto px-6 py-16">

                {/* معرفی */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 border border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-black text-xl mb-5">
                          ما که هستیم ؟
                        </h3>

                    <p className="leading-9 text-zinc-600 dark:text-zinc-300">
                        فروشگاه اینترنتی <strong>برجک</strong> با هدف ارائه کالاهای باکیفیت،
                        قیمت مناسب و خدمات حرفه‌ای راه‌اندازی شده است.

                        ما معتقدیم مشتری باید بتواند بدون نگرانی از اصالت کالا، امنیت پرداخت
                        و کیفیت خدمات خرید کند.

                        به همین دلیل همواره تلاش می‌کنیم بهترین تجربه خرید اینترنتی را
                        برای مشتریان خود فراهم کنیم.
                    </p>
                </div>

                {/* اهداف */}
                <div className="grid md:grid-cols-2 gap-6 mt-8">

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 border border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-black text-xl mb-5">
                            ماموریت ما
                        </h3>

                        <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
                            <li>✔ ارائه محصولات با کیفیت</li>
                            <li>✔ قیمت‌گذاری منصفانه</li>
                            <li>✔ ارسال سریع سفارشات</li>
                            <li>✔ پشتیبانی واقعی</li>
                            <li>✔ احترام به حقوق مشتری</li>
                        </ul>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 border border-zinc-100 dark:border-zinc-800">
                        <h3 className="font-black text-xl mb-5">
                            ارزش‌های ما
                        </h3>

                        <ul className="space-y-3 text-zinc-600 dark:text-zinc-300">
                            <li>🔒 امنیت اطلاعات کاربران</li>
                            <li>⭐ تضمین اصالت کالا</li>
                            <li>🚚 ارسال سریع</li>
                            <li>📞 پاسخگویی مناسب</li>
                            <li>❤️ رضایت مشتری</li>
                        </ul>
                    </div>

                </div>

                {/* آمار */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 text-center border border-zinc-100 dark:border-zinc-800">
                        <div className="text-3xl font-black text-zinc-800 dark:text-zinc-200">
                            +1000
                        </div>
                        <div className="mt-2 text-zinc-500">
                            محصول
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 text-center border border-zinc-100 dark:border-zinc-800">
                        <div className="text-3xl font-black text-zinc-800 dark:text-zinc-200">
                            رضایت
                        </div>
                        <div className="mt-2 text-zinc-500">
                            مشتری
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 text-center border border-zinc-100 dark:border-zinc-800">
                        <div className="text-3xl font-blacktext-zinc-800 dark:text-zinc-200">
                            24/7
                        </div>
                        <div className="mt-2 text-zinc-500">
                            پشتیبانی
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 p-8 text-center border border-zinc-100 dark:border-zinc-800">
                        <div className="text-3xl font-black text-zinc-800 dark:text-zinc-200">
                            حمل و نقل
                        </div>

                        <div className="mt-2 text-zinc-500">
                            ارسال به سراسر کشور
                        </div>
                    </div>

                </div>

            </section>
        </div>
    );
}