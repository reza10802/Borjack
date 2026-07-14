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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">

        <h2 className="mb-2 text-lg font-bold text-gray-800">
          {title}
        </h2>

        <p className="mb-6 text-sm text-gray-600">
          {description}
        </p>

        <div className="flex justify-end gap-3">

          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            {confirmText}
          </button>

        </div>

      </div>
    </div>
  );
}