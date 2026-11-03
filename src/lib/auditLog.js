
import { prisma } from "@/lib/db";
import { headers } from "next/headers";

function normalizePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  description,
  oldValue,
  newValue,
}) {
  try {
    if (!userId || !action || !entityType) {
      throw new Error("Missing required audit log fields");
    }

    const headersList = await headers();

    const forwardedFor = headersList.get("x-forwarded-for");
    const ipAddress =
      forwardedFor?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      null;

    const userAgent = headersList.get("user-agent") || null;

    const data = {
      userId,
      action,
      entityType,
      entityId: entityId == null ? "" : String(entityId),
      description: description ?? null,
      ipAddress,
      userAgent,
    };

    // برای JSONهای اختیاری، null یا undefined را به Prisma ارسال نکن.
    // در این حالت ستون دیتابیس NULL باقی می‌ماند.
    if (oldValue !== null && oldValue !== undefined) {
      data.oldValue = oldValue;
    }

    if (newValue !== null && newValue !== undefined) {
      data.newValue = newValue;
    }

    return await prisma.auditLog.create({ data });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log:", {
      action,
      entityType,
      entityId: entityId == null ? null : String(entityId),
      error: err instanceof Error ? err.message : String(err),
    });

    // برای سازگاری با رفتار قبلی، خطای لاگ باعث شکست عملیات اصلی نمی‌شود.
    return null;
  }
}

export async function getAuditLogs({
  page = 1,
  limit = 50,
  action,
  userId,
  entityType,
} = {}) {
  const safePage = normalizePositiveInt(page, 1, 1_000_000);
  const safeLimit = normalizePositiveInt(limit, 50, 100);

  const where = {};

  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}
