"use client";

import Toast from "@/components/ui/Toast";

export default function ToastContainer({
  toasts = [],
  onDismiss,
}) {
  if (!toasts.length) return null;

  return (
    <div
      aria-label="اعلان‌های سایت"
      className="
        pointer-events-none
        fixed inset-x-0 top-4 z-[1200]
        px-4
        sm:left-auto sm:right-4 sm:w-full sm:max-w-sm
      "
    >
      <div className="flex flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast
              toast={toast}
              onDismiss={onDismiss}
            />
          </div>
        ))}
      </div>
    </div>
  );
}