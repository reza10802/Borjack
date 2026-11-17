// lib/admin-auth.js — server-side page guards. Role/active/session-version come from the DB,
// not from (possibly stale) JWT claims.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyJwt } from "@/lib/session";

export async function getCurrentUser() {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;
  try {
    const claims = verifyJwt(token);
    if (!claims?.id || claims.isPhoneVerified !== true) return null;
    const user = await prisma.user.findUnique({
      where: { id: claims.id },
      select: { id: true, role: true, isActive: true, isPhoneVerified: true, tokenVersion: true },
    });
    if (!user || !user.isActive || !user.isPhoneVerified) return null;
    if ((claims.tv ?? 0) !== user.tokenVersion) return null;
    return { id: user.id, role: user.role };
  } catch {
    return null;
  }
}

export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}
