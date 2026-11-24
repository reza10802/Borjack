"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "تایید",
  cancelText = "انصراف",
  onConfirm,
  onCancel,
  danger = false,
}) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      await onConfirm?.();
    } catch (error) {
      console.error("ConfirmDialog action failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const buttonBase = `
    inline-flex items-center justify-center
    rounded-xl px-5 py-2.5
    text-sm font-medium
    transition
    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-offset-2
    disabled:cursor-not-allowed
    disabled:opacity-60
  `;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title || "تأیید عملیات"}
      size="sm"
      closeOnOverlay={false}
    >
      {description && (
        <p className="text-sm leading-7 text-[var(--color-text-muted)]">
          {description}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className={`
            ${buttonBase}
            border border-[var(--color-border)]
            bg-[var(--color-surface-2)]
            text-[var(--color-text)]
            hover:opacity-80
          `}
        >
          {cancelText}
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className={`
            ${buttonBase}
            text-white
            focus-visible:ring-offset-2
            ${
              danger
                ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                : "bg-[var(--color-primary)] hover:opacity-90 focus-visible:ring-[var(--color-primary)]"
            }
          `}
        >
          {submitting ? "در حال انجام..." : confirmText}
        </button>
      </div>
    </Modal>
  );
}