import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { redactSensitive } from "@/lib/security";
import { LogAction } from "@/generated/prisma";

const ACTIONS = new Set(Object.values(LogAction));

export async function GET(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page = Math.min(Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1), 10000);
  const rawAction = searchParams.get("action");
  const action = rawAction && ACTIONS.has(rawAction) ? rawAction : undefined;
  const limit = 50;
  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true, action: true, entityType: true, entityId: true, description: true,
        oldValue: true, newValue: true, ipAddress: true, createdAt: true, userId: true, userLabel: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const safe = logs.map(({ userLabel, ...l }) => ({
    ...l,
    oldValue: redactSensitive(l.oldValue), // defence in depth for historical rows
    newValue: redactSensitive(l.newValue),
    user: l.user ?? { id: null, name: userLabel || "کاربر حذف‌شده" },
  }));
  return NextResponse.json({ logs: safe, total, page, totalPages: Math.ceil(total / limit) });
}
