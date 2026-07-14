import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin } from "@/lib/auth";
import { PaymentStatus , OrderStatus  } from "@/generated/prisma";

// GET /api/admin/orders
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit")) || 20),
  );
  const status = searchParams.get("status");
  const paymentStatus = searchParams.get("paymentStatus");
  const search = searchParams.get("search")?.trim();

  const where = {
    paymentStatus: {
      in: [PaymentStatus.PAID, PaymentStatus.PENDING],
    },
  };

  if (status && Object.values(OrderStatus).includes(status)) {
    where.status = status;
  }

  if (paymentStatus && Object.values(PaymentStatus).includes(paymentStatus)) {
    where.paymentStatus = paymentStatus;
  }

  if (search) {
    where.OR = [
      {
        user: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
      },
      {
        user: {
          phone: {
            contains: search,
          },
        },
      },
    ];
  }

  const skip = (page - 1) * limit;

  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  image: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where,
      }),
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "خطا در دریافت سفارشات",
      },
      {
        status: 500,
      },
    );
  }
}
