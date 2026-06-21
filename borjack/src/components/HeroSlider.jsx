"use client"
import { useState, useEffect, useRef, useCallback } from "react";

const slides = [
  {
    badge: "جدید",
    title: "تجربه‌ای متفاوت از خرید آنلاین",
    desc: "هزاران محصول با بهترین قیمت و ارسال سریع در سراسر کشور",
    cta: "همین حالا خرید کن",
    emoji: "🛍️",
    bg: "linear-gradient(135deg, #1a0533 0%, #3b1a6b 50%, #6b2fa0 100%)",
    badgeStyle: { background: "rgba(180,120,255,0.25)", color: "#d4a8ff", border: "1px solid rgba(180,120,255,0.4)" },
    ctaColor: "#9b59f0",
    circleColor: "rgba(155,89,240,0.18)",
  },
  {
    badge: "ویژه تابستان",
    title: "تا ۵۰٪ تخفیف روی محصولات برگزیده",
    desc: "فرصت را از دست نده — پیشنهاد تابستانه تا پایان ماه معتبر است",
    cta: "مشاهده تخفیف‌ها",
    emoji: "⚡",
    bg: "linear-gradient(135deg, #012233 0%, #034a6e 50%, #0a7bb5 100%)",
    badgeStyle: { background: "rgba(80,180,255,0.2)", color: "#7acfff", border: "1px solid rgba(80,180,255,0.35)" },
    ctaColor: "#1a8ee8",
    circleColor: "rgba(26,142,232,0.18)",
  },
  {
    badge: "پرفروش",
    title: "جدیدترین گجت‌های تکنولوژی",
    desc: "آخرین محصولات دیجیتال با گارانتی اصالت و ضمانت بازگشت وجه",
    cta: "کشف محصولات",
    emoji: "💻",
    bg: "linear-gradient(135deg, #1f0a00 0%, #5c1f00 50%, #a03200 100%)",
    badgeStyle: { background: "rgba(255,120,50,0.2)", color: "#ffaa77", border: "1px solid rgba(255,120,50,0.35)" },
    ctaColor: "#e0520c",
    circleColor: "rgba(224,82,12,0.18)",
  },
  {
    badge: "اعضای ویژه",
    title: "باشگاه مشتریان طلایی",
    desc: "عضو شو و از تخفیف‌های انحصاری، ارسال رایگان و پشتیبانی ۲۴ ساعته بهره‌مند شو",
    cta: "عضویت رایگان",
    emoji: "🏆",
    bg: "linear-gradient(135deg, #001a0d 0%, #004d29 50%, #007a3d 100%)",
    badgeStyle: { background: "rgba(60,220,120,0.2)", color: "#7fffa0", border: "1px solid rgba(60,220,120,0.35)" },
    ctaColor: "#1faa55",
    circleColor: "rgba(31,170,85,0.18)",
  },
];

const INTERVAL = 4000;

export default function HeroSlider() {
  const [cur, setCur] = useState(0);
  const [progress, setProgress] = useState(0);
  const progRef = useRef(null);
  const startTimeRef = useRef(null);
  const rafRef = useRef(null);

  const goTo = useCallback((n) => {
    setCur(((n % slides.length) + slides.length) % slides.length);
    setProgress(0);
    startTimeRef.current = null;
  }, []);

  useEffect(() => {
    const tick = (ts) => {
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      const pct = Math.min((elapsed / INTERVAL) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        setCur((c) => (c + 1) % slides.length);
        setProgress(0);
        startTimeRef.current = null;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cur]);

  // Touch/swipe support
  const touchStartX = useRef(null);
  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) goTo(cur + (dx > 0 ? -1 : 1));
    touchStartX.current = null;
  };

  const slide = slides[cur];

  return (
    <section
      className="my-8 rounded-2xl overflow-hidden relative"
      style={{ background: "#0a0a0a", direction: "rtl", userSelect: "none", height: 340 }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Slide background */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: slide.bg,
          transition: "background 0.6s ease",
        }}
      />

      {/* Decorative circles */}
      <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "#fff", opacity: 0.12, right: -60, top: -80 }} />
      <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: "#fff", opacity: 0.1, right: 160, bottom: -60 }} />

      {/* Emoji illustration */}
      <div style={{ position: "absolute", left: 48, top: "50%", transform: "translateY(-50%)", width: 180, height: 180, borderRadius: "50%", background: slide.circleColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 72, transition: "background 0.5s" }}>
        {slide.emoji}
      </div>

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, padding: "0 56px", height: "100%", display: "flex", alignItems: "center" }}>
        <div>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", padding: "4px 12px", borderRadius: 100, marginBottom: 14, textTransform: "uppercase", ...slide.badgeStyle }}>
            {slide.badge}
          </span>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#fff", lineHeight: 1.25, marginBottom: 10, maxWidth: 360 }}>
            {slide.title}
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.68)", marginBottom: 24, maxWidth: 300, lineHeight: 1.65 }}>
            {slide.desc}
          </div>
          <button
            style={{ padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: slide.ctaColor, color: "#fff", transition: "transform 0.15s, opacity 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "scale(1.04)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {slide.cta}
          </button>
        </div>
      </div>

      {/* Prev button */}
      <button
        onClick={() => goTo(cur - 1)}
        aria-label="اسلاید قبلی"
        style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", right: 16, zIndex: 10, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >‹</button>

      {/* Next button */}
      <button
        onClick={() => goTo(cur + 1)}
        aria-label="اسلاید بعدی"
        style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", left: 16, zIndex: 10, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
      >›</button>

      {/* Dots */}
      <div style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 10 }}>
        {slides.map((_, i) => (
          <div
            key={i}
            onClick={() => goTo(i)}
            style={{ width: i === cur ? 20 : 8, height: 8, borderRadius: 100, background: i === cur ? "#fff" : "rgba(255,255,255,0.3)", cursor: "pointer", transition: "all 0.3s" }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, height: 3, background: "rgba(255,255,255,0.5)", width: `${progress}%`, transition: "width 0.08s linear", zIndex: 10 }} />
    </section>
  );
}
