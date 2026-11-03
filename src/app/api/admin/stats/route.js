import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin } from "@/lib/auth";

export async function GET() {
  const { error } = await requireManagerOrAdmin();
  if (error) return error;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [products, users, todayOrders, outOfStock] = await Promise.all([
    prisma.product.count({
      where: {
        deletedAt: null,
      },
    }), ,
    prisma.user.count(),
    prisma.order.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    }),
    prisma.product.count({
      where: {
        deletedAt: null,
        stock: {
          lte: 0,
        },
      },
    }),
  ]);

  return NextResponse.json({
    products,
    users,
    todayOrders,
    outOfStock,
  });
}