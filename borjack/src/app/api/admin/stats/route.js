import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdminOrManager } from "../../../../lib/auth";
 
export async function GET() {
  const { session, error } = await requireAdminOrManager();
  if (error) return error;
 
  const today = new Date();
  today.setHours(0, 0, 0, 0);
 
  const [products, users, todayOrders, outOfStock] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.product.count({ where: { inStock: false } }),
  ]);
 
  return NextResponse.json({ products, users, todayOrders, outOfStock });
}