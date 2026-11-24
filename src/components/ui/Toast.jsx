"use client";

import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const TOAST_STYLES = {
  success: {
    Icon: CheckCircleIcon,
    container:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
    icon: "text-green-600 dark:text-green-400",
  },

  error: {
    Icon: ExclamationCircleIcon,
    container:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    icon: "text-red-600 dark:text-red-400",
  },

  warning: {
    Icon: ExclamationTriangleIcon,
    container:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    icon: "text-amber-600 dark:text-amber-400",
  },

  info: {
    Icon: InformationCircleIcon,
    container:
      "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    icon: "text-blue-600 dark:text-blue-400",
  },
};

export default function Toast({ toast, onDismiss }) {
  const type = TOAST_STYLES[toast.type]
    ? toast.type
    : "info";

  const { Icon, container, icon } = TOAST_STYLES[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`
        flex items-start gap-3
        rounded-xl border p-4
        shadow-lg backdrop-blur-sm
        ${container}
      `}
    >
      <Icon className={`mt-0.5 h-6 w-6 shrink-0 ${icon}`} />

      <div className="min-w-0 flex-1">
        {toast.title && (
          <p className="mb-1 text-sm font-bold">
            {toast.title}
          </p>
        )}

        <p className="break-words text-sm leading-6">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="بستن اعلان"
        className="
          shrink-0 rounded-lg p-1
          opacity-60 transition
          hover:bg-black/5 hover:opacity-100
          dark:hover:bg-white/10
        "
      >
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  );
}