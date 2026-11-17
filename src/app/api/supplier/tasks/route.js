
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSupplier } from "@/lib/auth";
import {
  getTasks,
  TASK_STATUSES,
} from "@/lib/task-service";

// GET /api/supplier/tasks
// دریافت تسک‌های اختصاص‌یافته به تأمین‌کننده
export async function GET(req) {
  const check = await requireSupplier();
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (
      status &&
      status !== "all" &&
      !TASK_STATUSES.includes(status)
    ) {
      return NextResponse.json(
        { error: "وضعیت تسک معتبر نیست" },
        { status: 400 },
      );
    }

    // محدودیت دسترسی: فقط تسک‌های اختصاص‌یافته به همین تأمین‌کننده
    const where = {
      toId: check.user.id,
      ...(status && status !== "all" ? { status } : {}),
    };

    const tasks = await getTasks(prisma, where);

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error) {
    console.error("GET SUPPLIER TASKS ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت تسک‌ها" },
      { status: 500 },
    );
  }
}
