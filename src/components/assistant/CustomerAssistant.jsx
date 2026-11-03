"use client";

import { useEffect, useRef, useState } from "react";

const INITIAL_MESSAGE = {
  id: "welcome",
  role: "assistant",
  content:
    "سلام! 👋 به برجک خوش اومدی. دنبال چه محصولی هستی؟ می‌تونی برند، بودجه یا کاربرد موردنظرت رو بگی تا راهنمایی‌ات کنم.",
};

const QUICK_PROMPTS = [
  "یک هدفون تا ۳ میلیون تومان",
  "گوشی برای عکاسی",
  "لپ‌تاپ برای دانشجو",
  "هدیه‌ی خاص تا ۲ میلیون",
];

// متن نوتیف کنار آیکون. هر جا خواستی عوضش کن.
const NUDGE_TITLE = "سلام! من دستیار برجکم 👋";
const NUDGE_TEXT =
  "نمی‌دونی کدوم محصول به دردت می‌خوره؟ بودجه و کاربردش رو بگو تا راهنمایی‌ات کنم.";

const NUDGE_KEY = "borjak-assistant-nudge-seen";
const NUDGE_DELAY_MS = 3000;
const NUDGE_HIDE_AFTER_MS = 18000;

function formatPrice(price) {
  if (typeof price !== "number") return "";
  return `${new Intl.NumberFormat("fa-IR").format(price)} تومان`;
}

function hasAvailableStock(product) {
  const availableStock = Number(product?.availableStock);

  return (
    Number.isSafeInteger(availableStock) &&
    availableStock > 0
  );
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/* ---------- SVG icons ---------- */

function BorjakBotIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* antenna */}
      <line
        x1="24"
        y1="5.5"
        x2="24"
        y2="10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle className="bj-blink fill-accent" cx="24" cy="4" r="2.4" />
      {/* roof / head top */}
      <path d="M24 10 40 22H8Z" fill="currentColor" />
      {/* ears */}
      <rect x="6.8" y="25" width="2.4" height="7" rx="1" fill="currentColor" />
      <rect x="38.8" y="25" width="2.4" height="7" rx="1" fill="currentColor" />
      {/* face + eyes */}
      <rect
        x="11.5"
        y="24.5"
        width="25"
        height="9"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        className="fill-accent"
        x="15.5"
        y="26.8"
        width="5"
        height="4.4"
        rx="1.1"
      />
      <rect
        className="fill-accent"
        x="27.5"
        y="26.8"
        width="5"
        height="4.4"
        rx="1.1"
      />
      {/* neck / platform */}
      <rect x="7" y="35.5" width="34" height="2.6" rx="0.6" fill="currentColor" />
      {/* legs + X brace */}
      <path
        d="M12 38.5V45M36 38.5V45"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M13 39.5 35 44.5M35 39.5 13 44.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      {/* chest core */}
      <circle className="fill-accent" cx="24" cy="42" r="1.9" />
      {/* feet */}
      <rect x="9.5" y="45" width="5" height="2" rx="0.5" fill="currentColor" />
      <rect x="33.5" y="45" width="5" height="2" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function SendIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

function ChevronIcon({ className = "" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

const ANIMATION_CSS = `
@keyframes bj-pop {
  from { opacity: 0; transform: translateY(14px) scale(.97); }
  to   { opacity: 1; transform: none; }
}
@keyframes bj-nudge {
  from { opacity: 0; transform: translateX(14px) scale(.95); }
  to   { opacity: 1; transform: none; }
}
@keyframes bj-float {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-3px); }
}
@keyframes bj-blink {
  0%, 100% { opacity: 1; }
  50%      { opacity: .35; }
}
.bj-pop   { animation: bj-pop .22s ease-out; transform-origin: bottom right; }
.bj-nudge { animation: bj-nudge .35s ease-out; }
.bj-float { animation: bj-float 3.2s ease-in-out infinite; }
.bj-blink { animation: bj-blink 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .bj-pop, .bj-nudge, .bj-float, .bj-blink { animation: none; }
}
`;

export default function CustomerAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nudgeDismissedRef = useRef(false);

  /* نوتیف کنار آیکون: برای هر بازدیدکننده یک‌بار در هر نشست */
  useEffect(() => {
    try {
      if (sessionStorage.getItem(NUDGE_KEY) === "1") return;
    } catch {
      // storage در دسترس نیست؛ ادامه می‌دیم
    }

    const showTimer = setTimeout(() => {
      if (nudgeDismissedRef.current) return;
      setShowNudge(true);
      try {
        sessionStorage.setItem(NUDGE_KEY, "1");
      } catch { }
    }, NUDGE_DELAY_MS);

    const hideTimer = setTimeout(
      () => setShowNudge(false),
      NUDGE_HIDE_AFTER_MS
    );

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  function dismissNudge() {
    nudgeDismissedRef.current = true;
    setShowNudge(false);
    try {
      sessionStorage.setItem(NUDGE_KEY, "1");
    } catch { }
  }

  function openChat() {
    dismissNudge();
    setIsOpen(true);
  }

  function toggleChat() {
    if (isOpen) {
      setIsOpen(false);
    } else {
      openChat();
    }
  }

  function autoResize(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  async function sendMessage(raw) {
    const content = raw.trim();

    if (!content || loading || content.length > 1000) {
      return;
    }

    const userMessage = {
      id: newId(),
      role: "user",
      content,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages
            .slice(-8)
            .map(({ role, content: text }) => ({
              role,
              content: text,
            })),
        }),
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "ارسال پیام ناموفق بود.");
      }

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          content: data.reply,
          products: Array.isArray(data.products) ? data.products : [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          isError: true,
          content:
            error.message || "ارتباط برقرار نشد. لطفاً دوباره تلاش کن.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(draft);
  }

  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      sendMessage(draft);
    }
  }

  function bubbleClasses(message) {
    if (message.role === "user") {
      return "rounded-2xl rounded-tl-md bg-primary text-white dark:bg-primary-light";
    }
    if (message.isError) {
      return "rounded-2xl rounded-tr-md border border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300";
    }
    return "rounded-2xl rounded-tr-md border border-border bg-surface text-text";
  }

  const showQuickPrompts = messages.length === 1 && !loading;

  return (
    <>
      <style>{ANIMATION_CSS}</style>

      {isOpen && (
        <section
          dir="rtl"
          aria-label="دستیار خرید برجک"
          className="bj-pop fixed inset-x-3 bottom-24 z-[90] flex h-[min(640px,calc(100dvh-8rem))] flex-col overflow-hidden rounded-3xl border border-border bg-surface text-text shadow-2xl shadow-black/25 sm:inset-x-auto sm:right-5 sm:w-[400px]"
        >
          {/* Header */}
          <header className="relative flex items-center gap-3 bg-primary px-4 py-3.5 text-white">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <BorjakBotIcon className="h-7 w-7 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-bold leading-6">
                دستیار برجک
              </h2>
              <p className="flex items-center gap-1.5 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                آماده‌ی راهنمایی در انتخاب محصول
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="بستن چت"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-linear-to-l from-accent via-accent-light to-transparent"
            />
          </header>

          {/* Messages */}
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            className="flex-1 space-y-4 overflow-y-auto bg-surface-2 px-3 py-4 sm:px-4"
          >
            {messages.map((message) => {
              const isUser = message.role === "user";

              return (
                <div
                  key={message.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"
                    }`}
                >
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-7 shadow-sm ${bubbleClasses(
                      message
                    )}`}
                  >
                    {message.content}
                  </div>

                  {message.products?.length > 0 && (
                    <div className="mt-2 w-full space-y-2">
                      {message.products.map((product) => (
                        <a
                          key={product.id}
                          href={
                            product.slug
                              ? `/products/${encodeURIComponent(product.slug)}`
                              : undefined
                          }
                          className={`group flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 shadow-sm transition ${product.slug
                              ? "hover:border-accent hover:shadow-md"
                              : "pointer-events-none"
                            }`}
                        >
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.title}
                              loading="lazy"
                              className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[11px] text-text-muted">
                              بدون تصویر
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-medium leading-6 text-text transition group-hover:text-accent-hover">
                              {product.title}
                            </p>

                            {product.brand && (
                              <p className="text-xs text-text-muted">
                                {product.brand}
                              </p>
                            )}

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-bold text-primary dark:text-accent-light">
                                {formatPrice(product.price)}
                              </span>

                              {hasAvailableStock(product) ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                                  موجود
                                </span>
                              ) : (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:bg-red-950/50 dark:text-red-400">
                                  ناموجود
                                </span>
                              )}
                            </div>
                          </div>

                          {product.slug && (
                            <ChevronIcon className="h-5 w-5 shrink-0 text-text-muted transition group-hover:text-accent" />
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {showQuickPrompts && (
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-accent/60 bg-surface px-3 py-1.5 text-xs text-primary transition hover:border-accent hover:bg-accent/15 dark:text-accent-light"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div
                role="status"
                aria-label="در حال بررسی درخواستت"
                className="flex w-fit items-center gap-1.5 rounded-2xl rounded-tr-md border border-border bg-surface px-4 py-3.5 shadow-sm"
              >
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    style={{ animationDelay: `${delay}ms` }}
                    className="h-2 w-2 animate-bounce rounded-full bg-accent motion-reduce:animate-none"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-border bg-surface p-3"
          >
            <label htmlFor="borjak-assistant-message" className="sr-only">
              پیام شما
            </label>

            <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-2 p-1.5 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
              <textarea
                id="borjak-assistant-message"
                ref={inputRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  autoResize(event.target);
                }}
                onKeyDown={handleKeyDown}
                placeholder="مثلاً یک هدفون تا ۳ میلیون می‌خوام..."
                maxLength={1000}
                rows={1}
                disabled={loading}
                className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent px-2.5 py-2 text-base leading-6 text-text outline-none placeholder:text-text-muted/70 disabled:opacity-60 sm:text-sm"
              />

              <button
                type="submit"
                disabled={loading || !draft.trim()}
                aria-label="ارسال پیام"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <SendIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-2 text-center text-[11px] text-text-muted">
              اطلاعات قیمت و موجودی را پیش از خرید در صفحهٔ کالا بررسی کن.
            </p>
          </form>
        </section>
      )}

      {/* Launcher + nudge bubble */}
      <div dir="rtl" className="fixed bottom-5 right-5 z-[91] flex items-end gap-3">
        <div className="relative shrink-0">
          {!isOpen && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-ping rounded-full bg-accent/40 motion-reduce:hidden"
            />
          )}

          <button
            type="button"
            onClick={toggleChat}
            aria-label={
              isOpen ? "بستن دستیار خرید" : "باز کردن دستیار خرید برجک"
            }
            aria-expanded={isOpen}
            className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-primary text-white shadow-[0_10px_30px_-5px_rgba(220,151,80,0.55)] ring-2 ring-accent transition hover:scale-105 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {isOpen ? (
              <CloseIcon className="h-6 w-6" />
            ) : (
              <BorjakBotIcon className="h-9 w-9" />
            )}

            {!isOpen && (
              <span
                aria-hidden="true"
                className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-primary"
              />
            )}
          </button>
        </div>

        {showNudge && !isOpen && (
          <div className="bj-nudge relative mb-2 w-[min(260px,calc(100vw-7.5rem))]">
            <div className="bj-float relative rounded-2xl border border-border bg-surface p-3.5 text-text shadow-xl shadow-black/10">
              <button
                type="button"
                onClick={openChat}
                className="block w-full text-start"
              >
                <p className="text-sm font-bold text-text">{NUDGE_TITLE}</p>
                <p className="mt-1 text-xs leading-6 text-text-muted">
                  {NUDGE_TEXT}
                </p>
              </button>

              <button
                type="button"
                onClick={dismissNudge}
                aria-label="بستن پیام"
                className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-muted shadow transition hover:text-text"
              >
                <CloseIcon className="h-3 w-3" />
              </button>

              <span
                aria-hidden="true"
                className="absolute -right-1.5 bottom-5 h-3 w-3 rotate-45 border-r border-t border-border bg-surface"
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}