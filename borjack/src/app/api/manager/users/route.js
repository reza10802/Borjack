// src/app/api/manager/users/route.js
// دسترسی: فقط MANAGER

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { createAuditLog } from "@/lib/auditLog";

// GET — لیست همه کاربران
export async function GET(request) {
  const { session, error } = await requireManager();
  if (error) return error;

  const users = await db.user.findMany({
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

// PATCH — تغییر نقش کاربر
export async function PATCH(request) {
  const { session, error } = await requireManager();
  if (error) return error;

  const body = await request.json();
  const { userId, role } = body;

  const validRoles = ["CUSTOMER", "ADMIN", "MANAGER"];
  if (!userId || !validRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // نمی‌توان نقش خود را تغییر داد
  if (userId === session.id) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const before = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });

  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: { role },
    select: { id: true, name: true, role: true },
  });

  await createAuditLog({
    userId: session.id,
    action: "UPDATE_USER",
    entityType: "User",
    entityId: userId,
    description: `تغییر نقش "${before.name}" از ${before.role} به ${role}`,
    oldValue: { role: before.role },
    newValue: { role },
  });

  return NextResponse.json({ user: updated });
}

// DELETE — حذف کاربر
export async function DELETE(request) {
  const { session, error } = await requireManager();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId || userId === session.id) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const before = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, identifier: true, role: true },
  });

  if (!before) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await db.user.delete({ where: { id: userId } });

  await createAuditLog({
    userId: session.id,
    action: "DELETE_USER",
    entityType: "User",
    entityId: userId,
    description: `حذف کاربر "${before.name}" (${before.identifier})`,
    oldValue: before,
    newValue: null,
  });

  return NextResponse.json({ success: true });
}