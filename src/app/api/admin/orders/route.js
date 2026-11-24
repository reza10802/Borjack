import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  PaymentStatus,
  OrderStatus,
} from "@/generated/prisma";

// GET /api/admin/orders
export async function GET(req) {
  const check = await requireAdmin();

  if (check.error) {
    return check.error;
  }

  try {
    const { searchParams } = new URL(req.url);

    const requestedPage = Number(searchParams.get("page"));
    const requestedLimit = Number(searchParams.get("limit"));

    const page =
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(100, requestedLimit)
        : 20;

    const status = searchParams.get("status");
    const paymentStatus = searchParams.get("paymentStatus");
    const search = searchParams.get("search")?.trim().slice(0, 100);

    const where = {
      paymentStatus: {
        in: [
          PaymentStatus.PAID,
          PaymentStatus.PENDING,
        ],
      },
    };

    if (
      status &&
      Object.values(OrderStatus).includes(status)
    ) {
      where.status = status;
    }

    if (
      paymentStatus &&
      Object.values(PaymentStatus).includes(paymentStatus)
    ) {
      where.paymentStatus = paymentStatus;
    }

    // جست‌وجو بر اساس مشتری، شماره تماس،
    // نام محصول یا نام تأمین‌کننده
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
        {
          items: {
            some: {
              product: {
                title: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
          },
        },
        {
          items: {
            some: {
              supplier: {
                is: {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
        },
      ];
    }

    const skip = (page - 1) * limit;

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
            select: {
              id: true,
              productId: true,
              quantity: true,
              price: true,
              supplierId: true,

              // اطلاعات مالی ثابت‌شده در زمان ثبت سفارش
              basePriceAtPurchase: true,
              commissionPercentAtPurchase: true,
              originalPriceAtPurchase: true,
              supplierDiscountPercentAtPurchase: true,
              supplierDiscountAmountAtPurchase: true,
              supplierPayoutAtPurchase: true,
              commissionAmountAtPurchase: true,
              supplierSnapshotCaptured: true,

              product: {
                select: {
                  id: true,
                  title: true,
                  image: true,
                },
              },

              // مالک کالا در زمان ثبت سفارش
              supplier: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  isActive: true,
                },
              },
            },
          },

          // مرسوله‌های مستقل هر تأمین‌کننده
          fulfillments: {
            select: {
              id: true,
              orderId: true,
              supplierId: true,
              sellerKey: true,
              status: true,
              shippingMethod: true,
              shippingCost: true,
              handedOverAt: true,
              trackingCode: true,
              trackingCodeAddedAt: true,
              shippedAt: true,
              deliveredAt: true,
              issueNote: true,
              createdAt: true,
              updatedAt: true,

              supplier: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  isActive: true,
                },
              },

              items: {
                select: {
                  id: true,
                  orderItemId: true,
                  quantity: true,

                  orderItem: {
                    select: {
                      id: true,
                      productId: true,
                      quantity: true,
                      price: true,
                      supplierId: true,

                      // همان Snapshot مالی برای نمایش در مرسوله
                      basePriceAtPurchase: true,
                      commissionPercentAtPurchase: true,
                      originalPriceAtPurchase: true,
                      supplierDiscountPercentAtPurchase: true,
                      supplierDiscountAmountAtPurchase: true,
                      supplierPayoutAtPurchase: true,
                      commissionAmountAtPurchase: true,
                      supplierSnapshotCaptured: true,

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
    console.error("ADMIN_ORDERS_GET_ERROR", {
      message: error?.message,
      code: error?.code,
    });

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