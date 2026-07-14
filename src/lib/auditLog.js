import { prisma } from "@/lib/db";
import { headers } from "next/headers";

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
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: String(entityId),
        description,
        oldValue,
        newValue,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[AuditLog] Failed to write audit log:", err);
  }
}

export async function getAuditLogs({
  page = 1,
  limit = 50,
  action,
  userId,
  entityType,
} = {}) {
  const where = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, identifier: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}