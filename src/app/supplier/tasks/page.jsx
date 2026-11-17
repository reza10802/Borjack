
"use client";

import { useEffect, useState } from "react";

const STATUS_CONFIG = {
  TODO: {
    label: "در انتظار شروع",
    cls: "bg-zinc-500/10 text-zinc-600",
  },
  IN_PROGRESS: {
    label: "در حال انجام",
    cls: "bg-blue-500/10 text-blue-600",
  },
  COMPLETED: {
    label: "تکمیل‌شده",
    cls: "bg-emerald-500/10 text-emerald-600",
  },
};

const PRIORITY_CONFIG = {
  HIGH: {
    label: "بالا",
    cls: "bg-red-500/10 text-red-600",
  },
  MEDIUM: {
    label: "متوسط",
    cls: "bg-amber-500/10 text-amber-600",
  },
  LOW: {
    label: "کم",
    cls: "bg-green-500/10 text-green-600",
  },
};

const FILTERS = [
  { value: "all", label: "همه تسک‌ها" },
  { value: "TODO", label: "در انتظار شروع" },
  { value: "IN_PROGRESS", label: "در حال انجام" },
  { value: "COMPLETED", label: "تکمیل‌شده" },
];

function formatDate(value) {
  if (!value) return "تعیین نشده";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "نامعتبر";
  }

  return date.toLocaleString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOverdue(task) {
  if (!task.dueAt || task.status === "COMPLETED") {
    return false;
  }

  return new Date(task.dueAt).getTime() < Date.now();
}

export default function SupplierTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [drafts, setDrafts] = useState({});

  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [savingId, setSavingId] = useState(null);
  const [successId, setSuccessId] = useState(null);

  // دریافت تسک‌ها
  useEffect(() => {
    const controller = new AbortController();

    async function fetchTasks() {
      try {
        const query =
          filter === "all"
            ? ""
            : `?status=${filter}`;

        const res = await fetch(
          `/api/supplier/tasks${query}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await res.json().catch(() => ({}));

        if (controller.signal.aborted) return;

        if (!res.ok) {
          throw new Error(
            data.error || "خطا در دریافت تسک‌ها"
          );
        }

        const receivedTasks = data.tasks || [];

        setTasks(receivedTasks);

        setDrafts((previous) => {
          const next = { ...previous };

          for (const task of receivedTasks) {
            // پیش‌نویس کاربر هنگام تازه‌سازی اطلاعات از بین نرود.
            if (!next[task.id]) {
              next[task.id] = {
                status: task.status,
                supplierResponse: task.supplierResponse || "",
              };
            }
          }

          return next;
        });

        setError("");
      } catch (err) {
        if (
          err.name === "AbortError" ||
          controller.signal.aborted
        ) {
          return;
        }

        console.error("FETCH SUPPLIER TASKS ERROR:", err);

        setError(
          err.message || "خطا در ارتباط با سرور"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchTasks();

    return () => controller.abort();
  }, [filter]);

  // تغییر فیلتر
  const handleFilterChange = (nextFilter) => {
    if (filter === nextFilter) return;

    setLoading(true);
    setError("");
    setFilter(nextFilter);
  };

  // تغییر پیش‌نویس یک تسک
  const updateDraft = (taskId, field, value) => {
    setDrafts((previous) => ({
      ...previous,
      [taskId]: {
        ...previous[taskId],
        [field]: value,
      },
    }));

    setSuccessId(null);
  };

  // ذخیره وضعیت و پاسخ تسک
  const saveTask = async (task) => {
    if (savingId !== null) return;

    const draft = drafts[task.id];

    if (!draft) return;

    if (
      !STATUS_CONFIG[draft.status] ||
      typeof draft.supplierResponse !== "string"
    ) {
      return;
    }

    if (draft.supplierResponse.length > 5000) {
      alert("پاسخ نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد.");
      return;
    }

    setSavingId(task.id);
    setError("");
    setSuccessId(null);

    try {
      const res = await fetch(
        `/api/supplier/tasks/${task.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: draft.status,
            supplierResponse: draft.supplierResponse,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error || "ذخیره تسک ناموفق بود"
        );
      }

      setTasks((previous) =>
        previous.map((item) =>
          item.id === task.id ? data.task : item
        )
      );

      setDrafts((previous) => ({
        ...previous,
        [task.id]: {
          status: data.task.status,
          supplierResponse:
            data.task.supplierResponse || "",
        },
      }));

      setSuccessId(task.id);
    } catch (err) {
      console.error("SAVE SUPPLIER TASK ERROR:", err);
      setError(err.message || "خطا در ذخیره تسک");
    } finally {
      setSavingId(null);
    }
  };

  const counts = {
    total: tasks.length,
    TODO: tasks.filter((task) => task.status === "TODO").length,
    IN_PROGRESS: tasks.filter(
      (task) => task.status === "IN_PROGRESS"
    ).length,
    COMPLETED: tasks.filter(
      (task) => task.status === "COMPLETED"
    ).length,
  };

  return (
    <div className="space-y-6">
      {/* عنوان */}
      <div>
        <h1 className="text-xl font-bold">
          وظایف من
        </h1>

        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          وظایف اختصاص‌یافته از طرف مدیریت را مشاهده و پیگیری کن.
        </p>
      </div>

      {/* آمار */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "کل تسک‌ها",
            value: counts.total,
          },
          {
            label: "در انتظار شروع",
            value: counts.TODO,
          },
          {
            label: "در حال انجام",
            value: counts.IN_PROGRESS,
          },
          {
            label: "تکمیل‌شده",
            value: counts.COMPLETED,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <p className="text-xs text-[var(--color-text-muted)]">
              {item.label}
            </p>

            <p className="mt-2 text-2xl font-bold">
              {item.value.toLocaleString("fa-IR")}
            </p>
          </div>
        ))}
      </div>

      {/* فیلترها */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() =>
              handleFilterChange(item.value)
            }
            className={`rounded-xl border px-4 py-2 text-sm transition ${
              filter === item.value
                ? "btn-primary"
                : "border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* خطا */}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {/* فهرست تسک‌ها */}
      {loading ? (
        <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">
          در حال دریافت تسک‌ها...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] py-12 text-center">
          <p className="font-medium">
            تسکی برای نمایش وجود ندارد.
          </p>

          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            تسک‌های جدیدی که مدیریت به شما اختصاص دهد، اینجا نمایش داده می‌شوند.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {tasks.map((task) => {
            const draft = drafts[task.id] || {
              status: task.status,
              supplierResponse: task.supplierResponse || "",
            };

            const priority =
              PRIORITY_CONFIG[task.priority];

            const status =
              STATUS_CONFIG[task.status];

            const overdue = isOverdue(task);

            return (
              <article
                key={task.id}
                className="card flex flex-col gap-4 border border-[var(--color-border)] p-4 sm:p-5"
              >
                {/* عنوان و برچسب‌ها */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-bold">
                      {task.title}
                    </h2>

                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      ارسال‌شده توسط: {task.from?.name || "مدیریت"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        priority?.cls || ""
                      }`}
                    >
                      اولویت {priority?.label || "نامشخص"}
                    </span>

                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        status?.cls || ""
                      }`}
                    >
                      {status?.label || "نامشخص"}
                    </span>
                  </div>
                </div>

                {/* توضیحات */}
                {task.description && (
                  <div className="rounded-xl bg-[var(--color-surface-2)] p-3">
                    <p className="mb-1 text-xs font-semibold">
                      شرح وظیفه
                    </p>

                    <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[var(--color-text-muted)]">
                      {task.description}
                    </p>
                  </div>
                )}

                {/* مهلت انجام */}
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <p className="text-[var(--color-text-muted)]">
                    مهلت انجام:{" "}
                    <span
                      className={
                        overdue
                          ? "font-medium text-red-500"
                          : "font-medium text-[var(--color-text)]"
                      }
                    >
                      {formatDate(task.dueAt)}
                    </span>

                    {overdue && (
                      <span className="mr-2 text-red-500">
                        (گذشته)
                      </span>
                    )}
                  </p>

                  {task.completedAt && (
                    <p className="text-emerald-600">
                      تکمیل‌شده در: {formatDate(task.completedAt)}
                    </p>
                  )}
                </div>

                {/* تغییر وضعیت */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor={`task-status-${task.id}`}
                      className="mb-2 block text-sm font-medium"
                    >
                      وضعیت انجام
                    </label>

                    <select
                      id={`task-status-${task.id}`}
                      value={draft.status}
                      onChange={(e) =>
                        updateDraft(
                          task.id,
                          "status",
                          e.target.value
                        )
                      }
                      disabled={savingId !== null}
                      className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                    >
                      {FILTERS.filter(
                        (item) => item.value !== "all"
                      ).map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* پاسخ تأمین‌کننده */}
                  <div>
                    <label
                      htmlFor={`task-response-${task.id}`}
                      className="mb-2 block text-sm font-medium"
                    >
                      پاسخ و توضیحات پیشرفت
                    </label>

                    <textarea
                      id={`task-response-${task.id}`}
                      rows={3}
                      maxLength={5000}
                      value={draft.supplierResponse}
                      onChange={(e) =>
                        updateDraft(
                          task.id,
                          "supplierResponse",
                          e.target.value
                        )
                      }
                      disabled={savingId !== null}
                      placeholder="توضیح بده چه اقداماتی انجام شده است..."
                      className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:opacity-60"
                    />

                    <p className="mt-1 text-left text-xs text-[var(--color-text-muted)]">
                      {draft.supplierResponse.length.toLocaleString("fa-IR")}
                      {" / ۵۰۰۰"}
                    </p>
                  </div>
                </div>

                {/* ذخیره */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                  <div className="text-xs text-[var(--color-text-muted)]">
                    آخرین بروزرسانی: {formatDate(task.updatedAt)}
                  </div>

                  <div className="flex items-center gap-3">
                    {successId === task.id && (
                      <span className="text-xs text-emerald-600">
                        ذخیره شد
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => saveTask(task)}
                      disabled={
                        savingId !== null ||
                        (
                          draft.status === task.status &&
                          draft.supplierResponse ===
                            (task.supplierResponse || "")
                        )
                      }
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingId === task.id
                        ? "در حال ذخیره..."
                        : "ذخیره تغییرات"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
