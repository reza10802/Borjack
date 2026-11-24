"use client";

import { useEffect, useId, useState } from "react";
import Modal from "@/components/ui/Modal";

export default function PromptDialog({
  open,
  title,
  description,
  defaultValue = "",
  placeholder = "متن موردنظر را وارد کنید",
  confirmText = "ثبت",
  cancelText = "انصراف",
  required = false,
  multiline = false,
  inputType = "text",
  onConfirm,
  onCancel,
}) {
  const [value, setValue] = useState(String(defaultValue));
  const [error, setError] = useState("");

  const formId = useId();

  useEffect(() => {
    if (open) {
      setValue(String(defaultValue));
      setError("");
    }
  }, [open, defaultValue]);

  const handleSubmit = (event) => {
    event.preventDefault();

    if (required && !value.trim()) {
      setError("وارد کردن این مقدار الزامی است.");
      return;
    }

    onConfirm?.(value);
  };

  const inputClass = `
    w-full rounded-xl border
    border-[var(--color-border)]
    bg-[var(--color-surface)]
    px-4 py-3
    text-sm text-[var(--color-text)]
    outline-none transition
    placeholder:text-[var(--color-text-muted)]
    focus:border-[var(--color-primary)]
    focus:ring-2
    focus:ring-[var(--color-primary)]/20
  `;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title || "ورود اطلاعات"}
      size="sm"
      closeOnOverlay={false}
    >
      {description && (
        <p className="mb-4 text-sm leading-7 text-[var(--color-text-muted)]">
          {description}
        </p>
      )}

      <form id={formId} onSubmit={handleSubmit}>
        {multiline ? (
          <textarea
            autoFocus
            rows={4}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            placeholder={placeholder}
            className={`${inputClass} resize-y`}
          />
        ) : (
          <input
            autoFocus
            type={inputType}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            placeholder={placeholder}
            className={inputClass}
          />
        )}

        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="
            rounded-xl border border-[var(--color-border)]
            bg-[var(--color-surface-2)]
            px-5 py-2.5 text-sm font-medium
            text-[var(--color-text)]
            transition hover:opacity-80
          "
        >
          {cancelText}
        </button>

        <button
          type="submit"
          form={formId}
          className="
            rounded-xl bg-[var(--color-primary)]
            px-5 py-2.5 text-sm font-medium text-white
            transition hover:opacity-90
          "
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}