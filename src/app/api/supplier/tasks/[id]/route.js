
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireSupplier,
  logAction,
} from "@/lib/auth";
import {
  buildTaskStatusUpdate,
  TASK_STATUSES,
} from "@/lib/task-service";

const MAX_RESPONSE_LENGTH = 5000;

// PATCH /api/supplier/tasks/[id]
// تغییر وضعیت و ثبت پاسخ توسط تأمین‌کننده
export async function PATCH(req, { params }) {
  const check = await requireSupplier();
  if (check.error) return check.error;

  try {
    const { id } = await params;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "شناسه تسک معتبر نیست" },
        { status: 400 },
      );
    }

    const body = await req.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "اطلاعات ارسالی معتبر نیست" },
        { status: 400 },
      );
    }

    // تأمین‌کننده فقط مجاز به تغییر وضعیت و پاسخ خودش است.
    const allowedKeys = ["status", "supplierResponse"];

    if (
      Object.keys(body).length === 0 ||
      Object.keys(body).some(
        (key) => !allowedKeys.includes(key),
      )
    ) {
      return NextResponse.json(
        { error: "فیلد ارسالی مجاز نیست" },
        { status: 400 },
      );
    }

    const has = (key) =>
      Object.prototype.hasOwnProperty.call(body, key);

    // اعتبارسنجی وضعیت
    if (
      has("status") &&
      !TASK_STATUSES.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "وضعیت تسک معتبر نیست" },
        { status: 400 },
      );
    }

    // اعتبارسنجی پاسخ تأمین‌کننده
    if (
      has("supplierResponse") &&
      body.supplierResponse !== null &&
      (
        typeof body.supplierResponse !== "string" ||
        body.supplierResponse.length > MAX_RESPONSE_LENGTH
      )
    ) {
      return NextResponse.json(
        {
          error: `پاسخ نمی‌تواند بیشتر از ${MAX_RESPONSE_LENGTH} کاراکتر باشد`,
        },
        { status: 400 },
      );
    }

    const supplierResponse = has("supplierResponse")
      ? body.supplierResponse?.trim() || null
      : undefined;

    // دریافت و به‌روزرسانی فقط در محدوده مالکیت همین تأمین‌کننده
    const result = await prisma.$transaction(async (tx) => {
      const currentTask = await tx.task.findFirst({
        where: {
          id,
          toId: check.user.id,
        },
      });

      // برای جلوگیری از افشای وجود تسک دیگران، پاسخ 404 می‌دهیم.
      if (!currentTask) {
        return null;
      }

      const updateData = {};

      if (has("status")) {
        Object.assign(
          updateData,
          buildTaskStatusUpdate(
            body.status,
            currentTask,
          ),
        );
      }

      if (has("supplierResponse")) {
        updateData.supplierResponse = supplierResponse;
      }

      const updatedTask = await tx.task.update({
        where: {
          id: currentTask.id,
        },
        data: updateData,
        include: {
          from: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
          to: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      return {
        currentTask,
        updatedTask,
      };
    });

    if (!result) {
      return NextResponse.json(
        { error: "تسک پیدا نشد" },
        { status: 404 },
      );
    }

    const { currentTask, updatedTask } = result;

    await logAction({
      userId: check.user.id,
      action: "UPDATE_TASK",
      entityType: "Task",
      entityId: id,
      description: `تسک «${updatedTask.title}» توسط تأمین‌کننده به‌روزرسانی شد`,
      oldValue: {
        status: currentTask.status,
        done: currentTask.done,
        supplierResponse: currentTask.supplierResponse,
      },
      newValue: {
        status: updatedTask.status,
        done: updatedTask.done,
        supplierResponse: updatedTask.supplierResponse,
        completedAt: updatedTask.completedAt,
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: "تسک با موفقیت به‌روزرسانی شد",
    });
  } catch (error) {
    console.error("PATCH SUPPLIER TASK ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در به‌روزرسانی تسک" },
      { status: 500 },
    );
  }
}
