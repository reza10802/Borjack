export const metadata = {
  title: "قوانین و مقررات | برجک",
  description: "قوانین و شرایط استفاده از فروشگاه اینترنتی برجک",
};

export default function RulesPage() {
  const sections = [
    {
      title: "۱. پذیرش قوانین",
      body: "ورود کاربران به وب‌سایت برجک و ثبت سفارش، به منزله مطالعه، آگاهی و پذیرش کامل قوانین و مقررات فروشگاه است.",
    },
    {
      title: "۲. ثبت سفارش",
      body: "ثبت سفارش تنها پس از پرداخت موفق یا انتخاب روش پرداخت معتبر نهایی خواهد شد. فروشگاه حق لغو سفارش‌هایی که به علت خطا در قیمت، موجودی یا مشکلات فنی ثبت شده‌اند را دارد.",
    },
    {
      title: "۳. قیمت کالاها",
      body: "تمام قیمت‌ها به ریال درج شده‌اند و ممکن است بدون اطلاع قبلی تغییر کنند. قیمت نهایی سفارش، مبلغ ثبت‌شده در زمان تکمیل خرید خواهد بود.",
    },
    {
      title: "۴. ارسال سفارش",
      body: "سفارش‌ها پس از آماده‌سازی از طریق شرکت‌های حمل‌ونقل معتبر ارسال می‌شوند. مدت زمان تحویل بسته به شهر مقصد و شرایط شرکت حمل متفاوت خواهد بود.",
    },
    {
      title: "۵. اصالت کالا",
      body: "برجک اصالت تمامی کالاهای عرضه‌شده را تضمین می‌کند و تلاش دارد محصولات مطابق مشخصات اعلام‌شده به دست مشتری برسند.",
    },
    {
      title: "۶. مسئولیت کاربران",
      body: "کاربران موظف هستند اطلاعات صحیح و کامل شامل نام، شماره تماس، آدرس و کدپستی را ثبت کنند. مسئولیت هرگونه مغایرت اطلاعات بر عهده کاربر خواهد بود.",
    },
    {
      title: "۷. لغو سفارش",
      body: "امکان لغو سفارش تنها تا پیش از آماده‌سازی و ارسال کالا وجود دارد. پس از تحویل بسته به شرکت حمل، لغو سفارش امکان‌پذیر نخواهد بود.",
    },
    {
      title: "۸. حفظ اطلاعات کاربران",
      body: "اطلاعات شخصی کاربران نزد فروشگاه محرمانه بوده و مطابق قوانین جمهوری اسلامی ایران نگهداری می‌شود و در اختیار اشخاص ثالث قرار نخواهد گرفت؛ مگر در موارد قانونی.",
    },
    {
      title: "۹. تغییر قوانین",
      body: "برجک می‌تواند در هر زمان نسبت به اصلاح یا بروزرسانی قوانین اقدام کند. نسخه منتشرشده در وب‌سایت، معتبرترین نسخه خواهد بود.",
    },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--background-app)]"
    >
      {/* Hero */}
      <section className="bg-[var(--color-primary)] text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl font-black mb-5">
            قوانین و مقررات
          </h1>

          <p className="max-w-3xl mx-auto text-lg opacity-90 leading-9">
            لطفاً پیش از استفاده از خدمات فروشگاه، قوانین زیر را به دقت مطالعه نمایید.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 py-16">

        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">

          {sections.map((item, index) => (
            <div
              key={index}
              className="p-8 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800"
            >
              <h2 className="text-xl font-black text-[var(--color-primary)] dark:text-white mb-4">
                {item.title}
              </h2>

              <p className="leading-9 text-zinc-600 dark:text-zinc-300">
                {item.body}
              </p>
            </div>
          ))}

        </div>

        <div className="mt-10 rounded-3xl bg-[var(--color-primary)] text-white p-8 text-center">
          <h3 className="text-2xl font-black mb-3">
            سپاس از اعتماد شما
          </h3>

          <p className="opacity-90 leading-8">
            هدف ما ارائه تجربه‌ای امن، شفاف و حرفه‌ای برای تمامی مشتریان فروشگاه برجک است.
          </p>
        </div>

      </section>
    </div>
  );
}