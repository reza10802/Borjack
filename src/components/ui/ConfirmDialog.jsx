"use client";

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "تایید",
  cancelText = "انصراف",
  onConfirm,
  onCancel,
}) {
  if (!open) return null;

  const buttonBase =
    "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-gray-800">
          {title}
        </h2>

        <p className="mb-6 text-sm leading-6 text-gray-600">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={`${buttonBase} border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 focus-visible:ring-gray-400`}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`${buttonBase} bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}