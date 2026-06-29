import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";
import { createAuditLog } from "../../../../lib/auditLog";

export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      identifier: true,
      role: true,
      createdAt: true,
      _count: { select: { orders: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
}

export async function PATCH(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { userId, role } = await req.json();

  if (userId === session.id) {
    return NextResponse.json({ error: "نمی‌توانید نقش خود را تغییر دهید" }, { status: 400 });
  }

  const validRoles = ["CUSTOMER", "ADMIN", "MANAGER"];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: "نقش نامعتبر" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id: userId } });
  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, role: true },
  });

  await createAuditLog({
    userId: session.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: userId,
    description: `تغییر نقش "${before?.name}" از ${before?.role} به ${role}`,
    oldValue: { role: before?.role },
    newValue: { role },
  });

  return NextResponse.json({ user });
}

export async function DELETE(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (userId === session.id) {
    return NextResponse.json({ error: "نمی‌توانید حساب خود را حذف کنید" }, { status: 400 });
  }

  const before = await prisma.user.findUnique({ where: { id: userId } });
  await prisma.user.delete({ where: { id: userId } });

  await createAuditLog({
    userId: session.id,
    action: "DELETE_USER",
    entityType: "User",
    entityId: userId,
    description: `حذف کاربر "${before?.name}"`,
    oldValue: before,
  });

  return NextResponse.json({ success: true });
}