"use client";

import { useRef, useState, useEffect } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Autoplay } from "swiper/modules";

import "swiper/css";
import "swiper/css/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid";

const slides = [
  {
    badge: "جدید",
    title: "تجربه‌ای متفاوت از خرید آنلاین",
    desc: "هزاران محصول با بهترین قیمت و ارسال سریع در سراسر کشور",
    cta: "همین حالا خرید کن",
    bg: "linear-gradient(135deg,#1E2640 0%,#2B365A 50%,#384876 100%)",
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
    bg: "linear-gradient(135deg,#25304E 0%,#36466E 50%,#465B90 100%)",
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
    bg: "linear-gradient(135deg,#1E2640 0%,#35436B 50%,#4B5C8F 100%)",
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
    bg: "linear-gradient(135deg,#22314C 0%,#314769 50%,#435E89 100%)",
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

  const [activeSlide, setActiveSlide] = useState(0);

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
    <section
      className="relative my-8 h-[320px] sm:h-[420px] lg:h-[520px] lg:my-10 overflow-hidden rounded-3xl border border-zinc-200/50 dark:border-zinc-700/50 bg-white dark:bg-[#1E2640] shadow-xl shadow-black/5 dark:shadow-black/30"
    >
      <Swiper
        modules={[Navigation, Autoplay]}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={(swiper) => {
          setActiveSlide(swiper.realIndex);
        }}
        className="h-full"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={i} className="h-full">
            <div
              className="relative h-full overflow-hidden"
              style={{ background: slide.bg }}
            >
              <div className="absolute inset-0 bg-black/20" />
              <div className="relative z-10 flex h-full items-center px-6 py-8 sm:px-10 lg:px-20">
                <div className="max-w-2xl">
                  <span
                    style={slide.badgeStyle}
                    className=" inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold backdrop-blur-md shadow-lg "
                  >
                    {slide.badge}
                  </span>

                  <h2 className="mt-4 text-xl sm:text-4xl lg:text-5xl font-black leading-snug text-white">
                    {slide.title}
                  </h2>

                  <p className="mt-4 mb-6 max-w-xl text-sm sm:text-base lg:text-lg leading-6 sm:leading-7 text-white/85">
                    {slide.desc}
                  </p>

                  <button
                    className="btn-primary w-fit px-5 py-2.5 sm:px-6 sm:py-3 hover:scale-105 transition-transform duration-300"
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
        className=" hidden lg:flex items-center justify-center absolute right-5 top-1/2 z-20 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all duration-300 "
      >
        <ChevronRightIcon className="w-6 h-6" />

      </button>

      {/* Next */}
      <button
        ref={nextRef}
        className=" hidden lg:flex items-center justify-center absolute left-5 top-1/2 z-20 -translate-y-1/2 w-12 h-12 rounded-full bg-white/15 backdrop-blur-xl border border-white/20 text-white hover:bg-[var(--color-primary)] hover:border-[var(--color-primary)] transition-all duration-300 "
      >
        <ChevronLeftIcon className="w-6 h-6" />

      </button>

      {/* Progress */}
      <div className="absolute bottom-0 left-0 z-30 w-full h-1 bg-white/10 overflow-hidden">
        <div
          key={activeSlide}
          className="hero-progress h-full bg-gradient-to-r from-orange-500 to-orange-300"
        />
      </div>

    </section>
  );
}