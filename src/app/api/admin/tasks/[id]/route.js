
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  logAction,
} from "@/lib/auth";
import {
  buildTaskStatusUpdate,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@/lib/task-service";

const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 5000;

// PATCH /api/admin/tasks/[id]
// ویرایش اطلاعات یا وضعیت تسک توسط ادمین
export async function PATCH(req, { params }) {
  const check = await requireAdmin();
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

    const allowedKeys = [
      "title",
      "description",
      "priority",
      "dueAt",
      "status",
      "done",
    ];

    if (
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

    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: "هیچ اطلاعاتی برای ویرایش ارسال نشده است" },
        { status: 400 },
      );
    }

    // اعتبارسنجی عنوان
    if (has("title")) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > MAX_TITLE_LENGTH
      ) {
        return NextResponse.json(
          { error: "عنوان تسک معتبر نیست" },
          { status: 400 },
        );
      }
    }

    // اعتبارسنجی توضیحات
    if (
      has("description") &&
      body.description !== null &&
      (
        typeof body.description !== "string" ||
        body.description.trim().length >
          MAX_DESCRIPTION_LENGTH
      )
    ) {
      return NextResponse.json(
        { error: "توضیحات تسک معتبر نیست" },
        { status: 400 },
      );
    }

    // اعتبارسنجی اولویت
    if (
      has("priority") &&
      !TASK_PRIORITIES.includes(body.priority)
    ) {
      return NextResponse.json(
        { error: "اولویت تسک معتبر نیست" },
        { status: 400 },
      );
    }

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

    if (
      has("done") &&
      typeof body.done !== "boolean"
    ) {
      return NextResponse.json(
        { error: "وضعیت تکمیل تسک معتبر نیست" },
        { status: 400 },
      );
    }

    // جلوگیری از ناسازگاری status و done
    if (has("status") && has("done")) {
      const statusDone = body.status === "COMPLETED";

      if (body.done !== statusDone) {
        return NextResponse.json(
          {
            error:
              "وضعیت و مقدار تکمیل تسک با یکدیگر سازگار نیستند",
          },
          { status: 400 },
        );
      }
    }

    // اعتبارسنجی مهلت انجام
    let dueAt;

    if (has("dueAt")) {
      if (body.dueAt === null || body.dueAt === "") {
        dueAt = null;
      } else {
        if (typeof body.dueAt !== "string") {
          return NextResponse.json(
            { error: "مهلت انجام تسک معتبر نیست" },
            { status: 400 },
          );
        }

        dueAt = new Date(body.dueAt);

        if (Number.isNaN(dueAt.getTime())) {
          return NextResponse.json(
            { error: "تاریخ مهلت انجام معتبر نیست" },
            { status: 400 },
          );
        }
      }
    }

    const oldTask = await prisma.task.findUnique({
      where: { id },
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

    if (!oldTask) {
      return NextResponse.json(
        { error: "تسک پیدا نشد" },
        { status: 404 },
      );
    }

    const updateData = {};

    if (has("title")) {
      updateData.title = body.title.trim();
    }

    if (has("description")) {
      updateData.description =
        body.description?.trim() || null;
    }

    if (has("priority")) {
      updateData.priority = body.priority;
    }

    if (has("dueAt")) {
      updateData.dueAt = dueAt;
    }

    // استفاده از منطق مشترک وضعیت تسک
    if (has("status") || has("done")) {
      const nextStatus = has("status")
        ? body.status
        : body.done
          ? "COMPLETED"
          : "TODO";

      Object.assign(
        updateData,
        buildTaskStatusUpdate(nextStatus, oldTask)
      );
    }

    const updated = await prisma.task.update({
      where: { id },
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

    await logAction({
      userId: check.user.id,
      action: "UPDATE_TASK",
      entityType: "Task",
      entityId: id,
      description: `تسک «${updated.title}» ویرایش شد`,
      oldValue: {
        title: oldTask.title,
        description: oldTask.description,
        priority: oldTask.priority,
        dueAt: oldTask.dueAt,
        status: oldTask.status,
        done: oldTask.done,
      },
      newValue: {
        title: updated.title,
        description: updated.description,
        priority: updated.priority,
        dueAt: updated.dueAt,
        status: updated.status,
        done: updated.done,
        completedAt: updated.completedAt,
      },
    });

    return NextResponse.json({
      success: true,
      task: updated,
    });
  } catch (error) {
    console.error("PATCH ADMIN TASK ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در ویرایش تسک" },
      { status: 500 },
    );
  }
}

// DELETE /api/admin/tasks/[id]
// حذف تسک توسط ادمین
export async function DELETE(_req, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id } = await params;

    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { error: "شناسه تسک معتبر نیست" },
        { status: 400 },
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        status: true,
        done: true,
        dueAt: true,
        fromId: true,
        toId: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { error: "تسک پیدا نشد" },
        { status: 404 },
      );
    }

    await prisma.task.delete({
      where: { id },
    });

    await logAction({
      userId: check.user.id,
      action: "DELETE_TASK",
      entityType: "Task",
      entityId: id,
      description: `تسک «${task.title}» حذف شد`,
      oldValue: task,
      newValue: null,
    });

    return NextResponse.json({
      success: true,
      message: "تسک با موفقیت حذف شد",
    });
  } catch (error) {
    console.error("DELETE ADMIN TASK ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در حذف تسک" },
      { status: 500 },
    );
  }
}
