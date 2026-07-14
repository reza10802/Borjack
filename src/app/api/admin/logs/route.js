import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";

// GET_logs → GET

export async function GET(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;
 
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page") || 1);
  const action = searchParams.get("action") || undefined;
  const limit = 50;
 
  const where = action ? { action } : {};
 
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
 
  return NextResponse.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
}
 