// lib/admin-auth.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";

export async function getCurrentUser() {
  const token = (await cookies()).get("token")?.value;
  if (!token) return null;

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return user;
  } catch {
    return null;
  }
}

export async function requireAdminPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (user.role !== "ADMIN") {
    redirect("/admin");
  }

  return user;
}

export async function requireAdminOrManagerPage() {
  const user = await getCurrentUser();

  if (!user) redirect("/login");

  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    redirect("/");
  }

  return user;
}