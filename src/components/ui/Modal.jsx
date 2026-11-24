"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

const SIZES = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  full: "max-w-[95vw]",
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "lg",
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
}) {
  const [mounted, setMounted] = useState(false);

  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !mounted) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    document.body.style.overflow = "hidden";

    const panel = panelRef.current;

    const focusableElements = panel?.querySelectorAll(
      FOCUSABLE_SELECTOR
    );

    if (focusableElements?.length) {
      focusableElements[0].focus();
    } else {
      panel?.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const elements = panelRef.current?.querySelectorAll(
        FOCUSABLE_SELECTOR
      );

      if (!elements?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panelRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      document.body.style.overflow = previousOverflow;

      previouslyFocused?.focus?.();
    };
  }, [open, mounted, closeOnEscape]);

  if (!open || !mounted) return null;

  const modalSize = SIZES[size] || SIZES.lg;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (
            event.target === event.currentTarget &&
            closeOnOverlay
          ) {
            onCloseRef.current?.();
          }
        }}
        aria-hidden="true"
      />

      {/* Modal */}
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? "پنجره گفتگو" : undefined}
        tabIndex={-1}
        className={`
          relative z-10
          flex w-full ${modalSize}
          max-h-[90vh] min-h-0 flex-col
          overflow-hidden rounded-2xl
          border border-[var(--color-border)]
          bg-[var(--color-surface)]
          text-[var(--color-text)]
          shadow-2xl
          animate-[fadeIn_.2s_ease]
          outline-none
        `}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
          <h2
            id={title ? titleId : undefined}
            className="text-lg font-bold"
          >
            {title}
          </h2>

          {showCloseButton && (
            <button
              type="button"
              onClick={() => onCloseRef.current?.()}
              aria-label="بستن پنجره"
              className="
                flex h-9 w-9 shrink-0 items-center justify-center
                rounded-xl
                text-[var(--color-text-muted)]
                transition
                hover:bg-[var(--color-surface-2)]
                hover:text-[var(--color-text)]
                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-[var(--color-primary)]
              "
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-[var(--color-text)] sm:px-6">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-4 sm:px-6">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body
  );
}