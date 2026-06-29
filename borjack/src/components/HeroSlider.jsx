"use client";

import { useRef, useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";

const slides = [
  {
    badge: "جدید",
    title: "تجربه‌ای متفاوت از خرید آنلاین",
    desc: "هزاران محصول با بهترین قیمت و ارسال سریع در سراسر کشور",
    cta: "همین حالا خرید کن",
    emoji: "🛍️",
    bg: "linear-gradient(135deg, #1a0533 0%, #3b1a6b 50%, #6b2fa0 100%)",
    badgeStyle: {
      background: "rgba(180,120,255,0.25)",
      color: "#d4a8ff",
      border: "1px solid rgba(180,120,255,0.4)"
    },
    ctaColor: "#9b59f0",
    circleColor: "rgba(155,89,240,0.18)"
  },
  {
    badge: "ویژه تابستان",
    title: "تا ۵۰٪ تخفیف روی محصولات برگزیده",
    desc: "فرصت را از دست نده — پیشنهاد تابستانه تا پایان ماه معتبر است",
    cta: "مشاهده تخفیف‌ها",
    emoji: "⚡",
    bg: "linear-gradient(135deg, #012233 0%, #034a6e 50%, #0a7bb5 100%)",
    badgeStyle: {
      background: "rgba(80,180,255,0.2)",
      color: "#7acfff",
      border: "1px solid rgba(80,180,255,0.35)"
    },
    ctaColor: "#1a8ee8",
    circleColor: "rgba(26,142,232,0.18)"
  },
  {
    badge: "پرفروش",
    title: "جدیدترین گجت‌های تکنولوژی",
    desc: "آخرین محصولات دیجیتال با گارانتی اصالت و ضمانت بازگشت وجه",
    cta: "کشف محصولات",
    emoji: "💻",
    bg: "linear-gradient(135deg, #1f0a00 0%, #5c1f00 50%, #a03200 100%)",
    badgeStyle: {
      background: "rgba(255,120,50,0.2)",
      color: "#ffaa77",
      border: "1px solid rgba(255,120,50,0.35)"
    },
    ctaColor: "#e0520c",
    circleColor: "rgba(224,82,12,0.18)"
  },
  {
    badge: "اعضای ویژه",
    title: "باشگاه مشتریان طلایی",
    desc: "عضو شو و از تخفیف‌های انحصاری، ارسال رایگان و پشتیبانی ۲۴ ساعته بهره‌مند شو",
    cta: "عضویت رایگان",
    emoji: "🏆",
    bg: "linear-gradient(135deg, #001a0d 0%, #004d29 50%, #007a3d 100%)",
    badgeStyle: {
      background: "rgba(60,220,120,0.2)",
      color: "#7fffa0",
      border: "1px solid rgba(60,220,120,0.35)"
    },
    ctaColor: "#1faa55",
    circleColor: "rgba(31,170,85,0.18)"
  }
];

export default function HeroSlider() {
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const swiperRef = useRef(null);

  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (
      swiperRef.current &&
      prevRef.current &&
      nextRef.current
    ) {
      swiperRef.current.params.navigation.prevEl = prevRef.current;
      swiperRef.current.params.navigation.nextEl = nextRef.current;
      swiperRef.current.navigation.destroy();
      swiperRef.current.navigation.init();
      swiperRef.current.navigation.update();
    }
  }, []);

  return (
    <section className="relative my-8 h-[340px] rounded-2xl overflow-hidden">

      <Swiper
        modules={[Navigation, Autoplay]}
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onAutoplayTimeLeft={(swiper, time, prog) => {
          setProgress(1 - prog);
        }}
        className="h-full"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={i} className="h-full">
            <div
              className="relative h-full"
              style={{ background: slide.bg }}
            >

              <div className="relative z-10 h-full flex items-center px-14">
                <div>
                  <span
                    className="inline-block text-xs px-3 py-1 rounded-full mb-4"
                    style={slide.badgeStyle}
                  >
                    {slide.badge}
                  </span>

                  <h2 className="text-white text-3xl font-bold mb-3">
                    {slide.title}
                  </h2>

                  <p className="text-white/70 mb-6">
                    {slide.desc}
                  </p>

                  <button
                    className="px-6 py-2 rounded-md text-white font-semibold"
                    style={{ background: slide.ctaColor }}
                  >
                    {slide.cta}
                  </button>
                </div>
              </div>

            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Prev */}
      <button
        ref={prevRef}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 text-white"
      >
        ‹
      </button>

      {/* Next */}
      <button
        ref={nextRef}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 text-white"
      >
        ›
      </button>

      {/* progress */}
      <div className="absolute bottom-0 left-0 h-[3px] w-full bg-white/10">
        <div
          className="h-full bg-white transition-all"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

    </section>
  );
}