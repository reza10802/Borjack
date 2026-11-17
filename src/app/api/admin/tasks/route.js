
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  logAction,
} from "@/lib/auth";
import {
  createTask,
  getPaginatedTasks,
  validateTaskCreateInput,
  TASK_DEFAULT_PAGE_SIZE,
} from "@/lib/task-service";

// GET /api/admin/tasks
// دریافت صفحه‌ای تسک‌ها
export async function GET(req) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);

    const filter = searchParams.get("filter") || "received";
    const page = searchParams.get("page") || "1";
    const limit =
      searchParams.get("limit") ||
      String(TASK_DEFAULT_PAGE_SIZE);

    if (!["received", "sent", "all"].includes(filter)) {
      return NextResponse.json(
        { error: "فیلتر تسک معتبر نیست" },
        { status: 400 }
      );
    }

    let where = {};

    if (filter === "received") {
      where = { toId: check.user.id };
    } else if (filter === "sent") {
      where = { fromId: check.user.id };
    }

    const result = await getPaginatedTasks(
      prisma,
      where,
      { page, limit }
    );

    return NextResponse.json({
      tasks: result.tasks,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("GET ADMIN TASKS ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت تسک‌ها" },
      { status: 500 }
    );
  }
}

// POST /api/admin/tasks
// ایجاد تسک و اختصاص آن به تأمین‌کننده
export async function POST(req) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const body = await req.json();

    const validation = validateTaskCreateInput(body);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const {
      title,
      description,
      priority,
      toId,
      dueAt,
    } = validation.data;

    // فقط تأمین‌کننده فعال می‌تواند گیرنده تسک باشد.
    const supplier = await prisma.user.findFirst({
      where: {
        id: toId,
        role: "SUPPLIER",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });

    if (!supplier) {
      return NextResponse.json(
        {
          error: "تأمین‌کننده فعال موردنظر پیدا نشد",
        },
        { status: 404 }
      );
    }

    const task = await createTask(prisma, {
      title,
      description,
      priority,
      dueAt,
      fromId: check.user.id,
      toId: supplier.id,
    });

    await logAction({
      userId: check.user.id,
      action: "CREATE_TASK",
      entityType: "Task",
      entityId: task.id,
      description: `تسک «${task.title}» برای تأمین‌کننده «${supplier.name}» ایجاد شد`,
      newValue: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueAt: task.dueAt,
        fromId: task.fromId,
        toId: task.toId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        task,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST ADMIN TASKS ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در ساخت تسک" },
      { status: 500 }
    );
  }
}
