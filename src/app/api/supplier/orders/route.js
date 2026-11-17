
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSupplier } from "@/lib/auth";
import {
  FulfillmentStatus,
  PaymentStatus,
} from "@/generated/prisma";

export async function GET(req) {
  const auth = await requireSupplier();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(req.url);

    const rawPage = Number(searchParams.get("page"));
    const rawLimit = Number(searchParams.get("limit"));

    const page =
      Number.isSafeInteger(rawPage) && rawPage > 0
        ? rawPage
        : 1;

    const limit =
      Number.isSafeInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 50)
        : 20;

    const status = searchParams.get("status");

    if (
      status &&
      !Object.values(FulfillmentStatus).includes(status)
    ) {
      return NextResponse.json(
        { error: "وضعیت مرسوله معتبر نیست" },
        { status: 400 },
      );
    }

    // فقط مرسوله‌های متعلق به تأمین‌کننده جاری
    // و سفارش‌های پرداخت‌شده
    const where = {
      supplierId: auth.user.id,

      order: {
        is: {
          paymentStatus: PaymentStatus.PAID,
        },
      },

      ...(status ? { status } : {}),
    };

    const skip = (page - 1) * limit;

    const [fulfillments, total] = await Promise.all([
      prisma.orderFulfillment.findMany({
        where,

        select: {
          id: true,
          orderId: true,
          status: true,
          shippingMethod: true,
          trackingCode: true,
          trackingCodeAddedAt: true,
          handedOverAt: true,
          shippedAt: true,
          deliveredAt: true,
          issueNote: true,
          createdAt: true,
          updatedAt: true,

          // اطلاعات لازم برای ارسال سفارش
          order: {
            select: {
              id: true,
              createdAt: true,
              receiverName: true,
              receiverPhone: true,
              provinceName: true,
              cityName: true,
              address: true,
              postalCode: true,
            },
          },

          // فقط کالاهای متعلق به همین مرسوله
          items: {
            select: {
              id: true,
              quantity: true,

              orderItem: {
                select: {
                  id: true,
                  productId: true,

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
          },
        },

        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],

        skip,
        take: limit,
      }),

      prisma.orderFulfillment.count({
        where,
      }),
    ]);

    return NextResponse.json({
      fulfillments,

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
    console.error("SUPPLIER_ORDERS_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت سفارش‌های شما" },
      { status: 500 },
    );
  }
}
