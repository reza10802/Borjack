
"use client";

import { useEffect, useState } from "react";
import { Download, Plus, Share2, X } from "lucide-react";

// ---------------------------------------------------------
// Configuration
// ---------------------------------------------------------

const PACKAGE_ID = "site.borjak.twa";

const INSTALL_STATE_KEY = "borjak-install-prompt-state-v2";
const LEGACY_DISMISS_KEY = "borjak-install-dismissed-at";

const INITIAL_DELAY = 10 * 1000;
const CLOSE_COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const DECLINED_COOLDOWN = 14 * 24 * 60 * 60 * 1000;
const LEGACY_COOLDOWN = 24 * 60 * 60 * 1000;

const MAX_SHOWS = 3;

// ---------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------

function getDefaultState() {
    return {
        shows: 0,
        snoozedUntil: 0,
        installed: false,
    };
}

function readInstallState() {
    try {
        const raw = localStorage.getItem(INSTALL_STATE_KEY);

        if (!raw) {
            return getDefaultState();
        }

        const parsed = JSON.parse(raw);

        return {
            shows: Number.isSafeInteger(parsed.shows)
                ? Math.max(0, parsed.shows)
                : 0,

            snoozedUntil: Number.isFinite(parsed.snoozedUntil)
                ? parsed.snoozedUntil
                : 0,

            installed: parsed.installed === true,
        };
    } catch {
        return getDefaultState();
    }
}

function saveInstallState(nextState) {
    try {
        localStorage.setItem(
            INSTALL_STATE_KEY,
            JSON.stringify(nextState)
        );
    } catch (error) {
        console.warn("Could not save install state:", error);
    }
}

function updateInstallState(updates) {
    const current = readInstallState();

    const next = {
        ...current,
        ...updates,
    };

    saveInstallState(next);

    return next;
}

// ---------------------------------------------------------
// Android TWA installation detection
// ---------------------------------------------------------

async function checkBorjakInstalled() {
    if (
        typeof navigator === "undefined" ||
        typeof navigator.getInstalledRelatedApps !== "function"
    ) {
        return {
            supported: false,
            installed: false,
        };
    }

    try {
        const apps = await navigator.getInstalledRelatedApps();

        const installed = apps.some(
            (app) =>
                app.platform === "play" &&
                app.id === PACKAGE_ID
        );

        return {
            supported: true,
            installed,
        };
    } catch (error) {
        console.warn(
            "Could not check installed Borjak app:",
            error
        );

        return {
            supported: false,
            installed: false,
        };
    }
}

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

export default function InstallPrompt() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let showTimer = null;
        let deferredPrompt = null;
        let installationCheckFinished = false;

        const enteredAt = Date.now();

        // -------------------------------------------------
        // 1. Check standalone mode
        // -------------------------------------------------

        const isStandalone =
            window.matchMedia("(display-mode: standalone)").matches ||
            window.navigator.standalone === true;

        if (isStandalone) {
            return;
        }

        // -------------------------------------------------
        // 2. Detect device
        // -------------------------------------------------

        const userAgent = window.navigator.userAgent;

        const ios =
            /iPhone|iPad|iPod/i.test(userAgent) ||
            (
                navigator.platform === "MacIntel" &&
                navigator.maxTouchPoints > 1
            );

        const android = /Android/i.test(userAgent);

        if (!android && !ios) {
            return;
        }

        setIsIOS(ios);

        // -------------------------------------------------
        // 3. Check saved display policy
        // -------------------------------------------------

        let savedState = readInstallState();

        if (savedState.installed) {
            return;
        }

        if (savedState.shows >= MAX_SHOWS) {
            return;
        }

        if (savedState.snoozedUntil > Date.now()) {
            return;
        }

        // Compatibility with previous version
        try {
            const legacyDismissedAt = Number(
                localStorage.getItem(LEGACY_DISMISS_KEY)
            );

            if (
                Number.isFinite(legacyDismissedAt) &&
                legacyDismissedAt > 0 &&
                Date.now() - legacyDismissedAt < LEGACY_COOLDOWN
            ) {
                return;
            }
        } catch {
            // Continue without legacy storage.
        }

        // -------------------------------------------------
        // 4. Show prompt after initial delay
        // -------------------------------------------------

        const scheduleShow = () => {
            if (cancelled || showTimer !== null) {
                return;
            }

            const latestState = readInstallState();

            if (
                latestState.installed ||
                latestState.shows >= MAX_SHOWS ||
                latestState.snoozedUntil > Date.now()
            ) {
                return;
            }

            const elapsed = Date.now() - enteredAt;

            const remainingDelay = Math.max(
                0,
                INITIAL_DELAY - elapsed
            );

            showTimer = window.setTimeout(() => {
                showTimer = null;

                if (cancelled) return;

                const currentState = readInstallState();

                if (
                    currentState.installed ||
                    currentState.shows >= MAX_SHOWS ||
                    currentState.snoozedUntil > Date.now()
                ) {
                    return;
                }

                // Count only actual displays.
                updateInstallState({
                    shows: currentState.shows + 1,
                });

                setShow(true);
            }, remainingDelay);
        };

        // -------------------------------------------------
        // 5. Android events
        // -------------------------------------------------

        const handleBeforeInstallPrompt = (event) => {
            event.preventDefault();

            deferredPrompt = event;

            setInstallPrompt(event);

            // Keep compatibility with any other component
            // that may use this global reference.
            window.__borjakInstallPrompt = event;

            if (installationCheckFinished) {
                scheduleShow();
            }
        };

        const handleAppInstalled = () => {
            console.log("Borjak app installed");

            updateInstallState({
                installed: true,
                snoozedUntil: 0,
            });

            deferredPrompt = null;

            setInstallPrompt(null);
            setShow(false);
            setShowIOSGuide(false);

            window.__borjakInstallPrompt = null;
        };

        // Register event listener before async checking.
        // This prevents missing beforeinstallprompt.
        if (android) {
            window.addEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            );

            window.addEventListener(
                "appinstalled",
                handleAppInstalled
            );

            // Check whether the Android TWA is installed.
            (async () => {
                const result = await checkBorjakInstalled();

                if (cancelled) return;

                if (result.installed) {
                    updateInstallState({
                        installed: true,
                        snoozedUntil: 0,
                    });

                    deferredPrompt = null;

                    setInstallPrompt(null);
                    setShow(false);

                    window.__borjakInstallPrompt = null;

                    installationCheckFinished = true;

                    return;
                }

                // If API is supported but app is not installed,
                // clear a previous local installed flag.
                if (result.supported && !result.installed) {
                    savedState = updateInstallState({
                        installed: false,
                    });

                    if (
                        savedState.shows >= MAX_SHOWS ||
                        savedState.snoozedUntil > Date.now()
                    ) {
                        installationCheckFinished = true;
                        return;
                    }
                }

                // If API is unavailable, respect the saved
                // installed state rather than showing repeatedly.
                if (!result.supported && savedState.installed) {
                    installationCheckFinished = true;
                    return;
                }

                installationCheckFinished = true;

                if (deferredPrompt) {
                    scheduleShow();
                }
            })();
        }

        // -------------------------------------------------
        // 6. iOS behavior
        // -------------------------------------------------

        if (ios) {
            scheduleShow();
        }

        // -------------------------------------------------
        // 7. Cleanup
        // -------------------------------------------------

        return () => {
            cancelled = true;

            if (showTimer !== null) {
                clearTimeout(showTimer);
            }

            if (android) {
                window.removeEventListener(
                    "beforeinstallprompt",
                    handleBeforeInstallPrompt
                );

                window.removeEventListener(
                    "appinstalled",
                    handleAppInstalled
                );
            }
        };
    }, []);

    // -----------------------------------------------------
    // Android installation
    // -----------------------------------------------------

    const handleAndroidInstall = async () => {
        if (!installPrompt || isInstalling) {
            return;
        }

        const deferred = installPrompt;

        setIsInstalling(true);

        try {
            // The prompt must be called from this user action.
            await deferred.prompt();

            // The user's decision is available through userChoice.
            const choice = await deferred.userChoice;

            console.log(
                "Borjak install result:",
                choice?.outcome
            );

            if (choice?.outcome === "accepted") {
                updateInstallState({
                    installed: true,
                    snoozedUntil: 0,
                });
            } else {
                // User declined the browser installation dialog.
                updateInstallState({
                    snoozedUntil: Date.now() + DECLINED_COOLDOWN,
                });
            }

            setInstallPrompt(null);
            setShow(false);

            window.__borjakInstallPrompt = null;
        } catch (error) {
            console.error("Borjak installation error:", error);

            // Avoid reopening the prompt immediately after an error.
            updateInstallState({
                snoozedUntil: Date.now() + CLOSE_COOLDOWN,
            });

            setInstallPrompt(null);
            setShow(false);

            window.__borjakInstallPrompt = null;
        } finally {
            setIsInstalling(false);
        }
    };

    // -----------------------------------------------------
    // iOS installation guide
    // -----------------------------------------------------

    const handleIOSInstall = () => {
        setShowIOSGuide(true);
    };

    // -----------------------------------------------------
    // Close prompt
    // -----------------------------------------------------

    const handleClose = () => {
        updateInstallState({
            snoozedUntil: Date.now() + CLOSE_COOLDOWN,
        });

        try {
            localStorage.setItem(
                LEGACY_DISMISS_KEY,
                Date.now().toString()
            );
        } catch {
            // Ignore storage errors.
        }

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
                                disabled={isInstalling}
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
                                    disabled:cursor-wait
                                    disabled:opacity-60
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
                                        {isInstalling
                                            ? "در حال آماده‌سازی..."
                                            : "نصب برجک"}
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
