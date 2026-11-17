
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";
import { OrderStatus, PaymentStatus } from "@/generated/prisma";
import {
  consumeOrderStock,
  restoreOrderStockForCancellation,
} from "@/lib/stock-reservation";

// تغییر وضعیت سفارش‌های قدیمی که هنوز سیستم مرسوله ندارند.
const ADMIN_ALLOWED_TRANSITIONS = {
  [OrderStatus.PROCESSING]: [
    OrderStatus.READY_TO_SHIP,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY_TO_SHIP]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.PROCESSING,
  ],
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
  ],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.PENDING]: [],
};

// PATCH /api/admin/orders/[id]
// سفارش‌های دارای مرسوله باید از طریق API مدیریت مرسوله‌ها کنترل شوند.
export async function PATCH(req, { params }) {
  const check = await requireAdmin();

  if (check.error) {
    return check.error;
  }

  try {
    const orderId = Number((await params).id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "شناسه سفارش نامعتبر است" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    const status = body?.status;

    if (!Object.values(OrderStatus).includes(status)) {
      return NextResponse.json(
        { error: "وضعیت نامعتبر است" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // ترتیب قفل‌گذاری با مسیرهای پرداخت یکسان است:
      // ابتدا کاربر، سپس سفارش.
      await tx.$queryRaw`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${check.user.id}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${orderId}
        FOR UPDATE
      `;

      const before = await tx.order.findUnique({
        where: {
          id: orderId,
        },
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
          fulfillments: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!before) {
        return {
          error: "سفارش پیدا نشد",
          statusCode: 404,
        };
      }

      // سفارش‌های جدید دارای مرسوله هستند.
      // وضعیت آن‌ها باید از طریق وضعیت مرسوله‌ها مدیریت شود.
      if (before.fulfillments.length > 0) {
        return {
          error:
            "وضعیت این سفارش از طریق مرسوله‌های آن مدیریت می‌شود.",
          statusCode: 409,
        };
      }

      if (before.paymentStatus !== PaymentStatus.PAID) {
        return {
          error: "این سفارش هنوز پرداخت نشده است.",
          statusCode: 400,
        };
      }

      if (before.status === status) {
        return {
          error: "سفارش همین الان در همین وضعیت قرار دارد.",
          statusCode: 400,
        };
      }

      // سفارش دارای مشکل فنی موجودی نباید وارد مراحل ارسال شود.
      if (
        before.stockReservationStatus === "ISSUE" ||
        before.stockIssueAt
      ) {
        return {
          error:
            "این سفارش مشکل موجودی دارد و قبل از رفع آن امکان تغییر وضعیت وجود ندارد.",
          statusCode: 409,
        };
      }

      // بررسی ترتیب مجاز تغییر وضعیت سفارش‌های قدیمی
      if (
        !(ADMIN_ALLOWED_TRANSITIONS[before.status] || []).includes(status)
      ) {
        return {
          error:
            "این تغییر وضعیت مجاز نیست. سفارش ارسال‌شده، تحویل‌شده یا لغوشده قابل بازگشت نیست.",
          statusCode: 409,
        };
      }

      // مدیریت موجودی سفارش‌های قدیمی
      let restocked = false;
      let reservationReleased = false;

      if (status === OrderStatus.CANCELLED) {
        const inventoryResult =
          await restoreOrderStockForCancellation(tx, before);

        restocked = inventoryResult.restocked;
        reservationReleased = inventoryResult.reservationReleased;
      } else if (
        before.stockReservationStatus === "RESERVED"
      ) {
        await consumeOrderStock(tx, before);
      }

      const order = await tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status,
        },
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
          fulfillments: {
            select: {
              id: true,
            },
          },
        },
      });

      return {
        order,
        oldStatus: before.status,
        restocked,
        reservationReleased,
      };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode },
      );
    }

    // ثبت تاریخچه تغییر وضعیت
    await logAction({
      userId: check.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "Order",
      entityId: String(orderId),
      description:
        `وضعیت سفارش #${orderId} از ${result.oldStatus} به ${status} تغییر کرد`,
      oldValue: {
        status: result.oldStatus,
      },
      newValue: {
        status,
        restocked: result.restocked,
        reservationReleased: result.reservationReleased,
        ...(status === OrderStatus.CANCELLED
          ? {
              note: "cancelled paid order: manual refund required",
            }
          : {}),
      },
    });

    return NextResponse.json({
      order: result.order,
    });
  } catch (error) {
    console.error("ADMIN_ORDER_STATUS_UPDATE_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    if (error?.code === "STOCK_RESERVATION_INTEGRITY") {
      return NextResponse.json(
        {
          error:
            "ناسازگاری در رزرو موجودی این سفارش وجود دارد. برای جلوگیری از تغییر اشتباه موجودی، عملیات انجام نشد.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "خطا در به‌روزرسانی سفارش" },
      { status: 500 },
    );
  }
}
