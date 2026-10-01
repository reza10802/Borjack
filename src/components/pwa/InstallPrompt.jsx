"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share2, X } from "lucide-react";

const DISMISS_KEY = "borjak-install-dismissed-at";
const DISMISS_DURATION = 24 * 60 * 60 * 1000;

export default function InstallPrompt() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);

    useEffect(() => {
        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;

        if (isStandalone) {
            return;
        }

        const userAgent = window.navigator.userAgent;

        const ios =
            /iPhone|iPad|iPod/i.test(userAgent) ||
            (navigator.platform === "MacIntel" &&
                navigator.maxTouchPoints > 1);

        const android = /Android/i.test(userAgent);

        if (!android && !ios) {
            return;
        }

        const dismissedAt = localStorage.getItem(DISMISS_KEY);

        if (
            dismissedAt &&
            Date.now() - Number(dismissedAt) < DISMISS_DURATION
        ) {
            return;
        }

        setIsIOS(ios);

        let iosTimer;

        const handleBeforeInstallPrompt = (event) => {
            console.log("🔥 beforeinstallprompt fired");

            event.preventDefault();

            setInstallPrompt(event);
            setShow(true);
        };

        const handleAppInstalled = () => {
            console.log("✅ Borjak installed");

            setInstallPrompt(null);
            setShow(false);
            setShowIOSGuide(false);
        };

        if (android) {
            window.addEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );
        }

        if (ios) {
            iosTimer = setTimeout(() => {
                setShow(true);
            }, 2000);
        }

        window.addEventListener("appinstalled", handleAppInstalled);

        return () => {
            if (android) {
                window.removeEventListener(
                    "beforeinstallprompt",
                    handleBeforeInstallPrompt
                );
            }

            window.removeEventListener(
                "appinstalled",
                handleAppInstalled
            );

            if (iosTimer) {
                clearTimeout(iosTimer);
            }
        };
    }, []);

    const handleAndroidInstall = async () => {
        if (!installPrompt) {
            return;
        }

        const result = await installPrompt.prompt();

        console.log("Install result:", result.outcome);

        // این event فقط یک بار قابل استفاده است
        setInstallPrompt(null);
        setShow(false);

        window.__borjakInstallPrompt = null;
    };

    const handleIOSInstall = () => {
        setShowIOSGuide(true);
    };

    const handleClose = () => {
        localStorage.setItem(DISMISS_KEY, Date.now().toString());

        setShow(false);
        setShowIOSGuide(false);
    };

    if (!show) {
        return null;
    }

    return (
        <div
            dir="rtl"
            className="
            fixed
            right-3
            top-3
            z-[9999]
            w-[calc(100%-1.5rem)]
            max-w-[380px]
            sm:right-4
            sm:top-4
        "
            style={{
                animation:
                    "borjak-install-in 350ms cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
        >
            <div
                className="
                overflow-hidden
                rounded-2xl
                border
                border-zinc-200/80
                bg-white/95
                shadow-[0_16px_50px_rgba(0,0,0,0.16)]
                backdrop-blur-xl
                dark:border-zinc-700/80
                dark:bg-zinc-900/95
            "
            >
                <div className="flex items-start gap-3 p-4">
                    {/* Logo */}
                    <div
                        className="
                        flex
                        h-12
                        w-12
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-xl
                        bg-black
                        ring-1
                        ring-black/10
                        dark:ring-white/10
                    "
                    >
                        <img
                            src="/images/logo3.png"
                            alt="برجک"
                            className="h-full w-full object-cover"
                        />
                    </div>

                    <div className="min-w-0 flex-1">
                        {/* Title + Close */}
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold leading-5 text-zinc-900 dark:text-white">
                                    {isIOS
                                        ? "برجک را به صفحه اصلی اضافه کنید"
                                        : "برجک را نصب کنید"}
                                </h3>

                                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                                    دسترسی سریع‌تر و تجربه بهتر در موبایل
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={handleClose}
                                aria-label="بستن"
                                className="
                                -mr-1
                                -mt-1
                                flex
                                h-8
                                w-8
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                text-zinc-400
                                transition
                                hover:bg-zinc-100
                                hover:text-zinc-700
                                active:scale-95
                                dark:hover:bg-zinc-800
                                dark:hover:text-white
                            "
                            >
                                <X size={17} />
                            </button>
                        </div>

                        {/* Android / iOS action */}
                        {!showIOSGuide && (
                            <button
                                type="button"
                                onClick={
                                    isIOS
                                        ? handleIOSInstall
                                        : handleAndroidInstall
                                }
                                className="
                                mt-3
                                flex
                                w-full
                                items-center
                                justify-center
                                gap-2
                                rounded-xl
                                bg-orange-500
                                px-4
                                py-2.5
                                text-sm
                                font-bold
                                text-white
                                shadow-sm
                                shadow-orange-500/20
                                transition
                                hover:bg-orange-600
                                active:scale-[0.98]
                            "
                            >
                                {isIOS ? (
                                    <>
                                        <Share2 size={17} />
                                        راهنمای نصب
                                    </>
                                ) : (
                                    <>
                                        <Download size={17} />
                                        نصب برجک
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* iOS Guide */}
                {isIOS && showIOSGuide && (
                    <div
                        className="
                        border-t
                        border-zinc-100
                        bg-zinc-50/70
                        px-4
                        pb-4
                        pt-3
                        dark:border-zinc-800
                        dark:bg-zinc-950/40
                    "
                    >
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                            برای نصب برجک:
                        </p>

                        <div className="mt-3 space-y-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="
                                    flex
                                    h-9
                                    w-9
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-lg
                                    bg-white
                                    text-zinc-700
                                    shadow-sm
                                    ring-1
                                    ring-zinc-200
                                    dark:bg-zinc-900
                                    dark:text-zinc-200
                                    dark:ring-zinc-700
                                "
                                >
                                    <Share2 size={17} />
                                </div>

                                <span className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                                    ۱. روی دکمه <strong>Share</strong> بزنید.
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div
                                    className="
                                    flex
                                    h-9
                                    w-9
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-lg
                                    bg-white
                                    text-zinc-700
                                    shadow-sm
                                    ring-1
                                    ring-zinc-200
                                    dark:bg-zinc-900
                                    dark:text-zinc-200
                                    dark:ring-zinc-700
                                "
                                >
                                    <Plus size={17} />
                                </div>

                                <span className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                                    ۲. گزینه{" "}
                                    <strong>Add to Home Screen</strong>{" "}
                                    را انتخاب کنید.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
