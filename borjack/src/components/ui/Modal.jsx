"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "lg",
  closeOnOverlay = true,
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
    full: "max-w-[95vw]",
  };

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => closeOnOverlay && onClose?.()}
      />

      {/* Modal */}
      <div
        className={`
        relative
        w-full
        ${sizes[size]}
        max-h-[90vh]
        rounded-2xl
        border
        border-[var(--color-border)]
        bg-[var(--color-surface)]
        shadow-2xl
        overflow-hidden
        animate-[fadeIn_.2s_ease]
      `}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="
            flex
            h-10
            w-10
            items-center
            justify-center
            rounded-xl
            text-[var(--color-text-muted)]
            hover:bg-[var(--color-surface-2)]
            hover:text-[var(--color-text)]
            transition
          "
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(90vh-150px)] overflow-y-auto px-6 py-6 text-[var(--color-text)]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-6 py-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}