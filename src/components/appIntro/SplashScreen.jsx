"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const STORAGE_KEY = "borjak-splash-shown";

export default function SplashScreen() {
  const [visible, setVisible] = useState(null);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const alreadyShown = localStorage.getItem(STORAGE_KEY);

    if (alreadyShown) {
      setVisible(false);
      return;
    }

    setVisible(true);

    let animationFrame;
    let startTime = performance.now();
    let pageReady = document.readyState === "complete";
    let finishing = false;

    let flashEndTimer;

    const flashStartTimer = setTimeout(() => {
      setFlash(true);

      flashEndTimer = setTimeout(() => {
        setFlash(false);
      }, 220);
    }, 120);

    const handleLoad = () => {
      pageReady = true;
    };

    window.addEventListener("load", handleLoad);

    const animate = (now) => {
      const elapsed = now - startTime;

      if (!pageReady) {
        const nextProgress = Math.min(
          (elapsed / 1400) * 94,
          94
        );

        setProgress(nextProgress);
      } else {
        setProgress((prev) => {
          const next = Math.min(prev + 4, 100);

          if (next >= 100 && !finishing) {
            finishing = true;

            setTimeout(() => {
              setExiting(true);

              setTimeout(() => {
                localStorage.setItem(STORAGE_KEY, "true");
                setVisible(false);
              }, 350);
            }, 100);
          }

          return next;
        });
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("load", handleLoad);
      clearTimeout(flashStartTimer);
      clearTimeout(flashEndTimer);
    };
  }, []);

  // تا قبل از مشخص شدن localStorage چیزی نمایش نده
  if (visible === null) {
    return null;
  }

  return (
    <>
      {visible && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center overflow-hidden bg-black">
          <div
            className={`flex w-full max-w-[320px] flex-col items-center px-6 transition-all duration-350 ease-out ${
              exiting
                ? "scale-[1.08] opacity-0"
                : "scale-100 opacity-100"
            }`}
          >
            {/* لوگو */}
            <div className="relative w-[190px] md:w-[230px]">
              <div className="relative overflow-hidden">
                <Image
                  src="/images/Intro.png"
                  alt="برجک"
                  width={260}
                  height={260}
                  priority
                  className="relative z-10 h-auto w-full object-contain"
                />

                {/* فلش فقط داخل محدوده لوگو */}
                <div
                  className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-100 ${
                    flash ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <div
                    className={`absolute top-[-35%] left-[-20%] h-[170%] w-[12%] rotate-[20deg] bg-white/90 blur-[3px] transition-transform duration-200 ease-out ${
                      flash
                        ? "translate-x-[1050%]"
                        : "-translate-x-[250%]"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* نوار پیشرفت */}
            <div className="mt-10 w-full">
              <div
                className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
                dir="ltr"
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-100 ease-linear"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex justify-center">
                <span
                  className="text-[11px] font-medium tracking-[0.2em] text-white/50"
                  dir="ltr"
                >
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}