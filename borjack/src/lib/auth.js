import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { createAuditLog } from "@/lib/auditLog";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "لاگین نشدی" }, { status: 401 }) };
  }
  return { session };
}

export async function requireAdminOrManager() {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "لاگین نشدی" }, { status: 401 }) };
  }
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return { error: Response.json({ error: "دسترسی ندارید" }, { status: 403 }) };
  }
  return { session };
}

// alias برای سازگاری با فایل‌هایی که requireManagerOrAdmin استفاده می‌کنن
export async function requireManagerOrAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: "لاگین نشدی", status: 401 };
  }
  if (!["ADMIN", "MANAGER"].includes(session.role)) {
    return { error: "دسترسی ندارید", status: 403 };
  }
  return { user: session };
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { error: "لاگین نشدی", status: 401 };
  }
  if (session.role !== "ADMIN") {
    return { error: "دسترسی ندارید", status: 403 };
  }
  return { user: session };
}

// logAction — wrapper دور createAuditLog
export async function logAction(req, { userId, action, entityType, entityId, description, oldValue, newValue }) {
  await createAuditLog({ userId, action, entityType, entityId, description, oldValue, newValue });
}