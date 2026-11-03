
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";
import { OrderStatus, PaymentStatus } from "@/generated/prisma";
import { consumeOrderStock } from "@/lib/stock-reservation";

// منیجر فقط این انتقال‌ها را مجاز است انجام دهد.
const MANAGER_ALLOWED_TRANSITIONS = {
  [OrderStatus.PROCESSING]: [OrderStatus.READY_TO_SHIP],
  [OrderStatus.READY_TO_SHIP]: [OrderStatus.SHIPPED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

// PATCH /api/admin/orders/[id] — تغییر وضعیت سفارش
export async function PATCH(req, { params }) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const orderId = Number((await params).id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "شناسه سفارش نامعتبر است" },
        { status: 400 },
      );
    }

    const { status } = await req.json();

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
        where: { id: orderId },
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
      });

      if (!before) {
        return {
          error: "سفارش پیدا نشد",
          statusCode: 404,
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

      // سفارش دارای مشکل موجودی نباید وارد مراحل ارسال شود.
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

      // محدودیت منیجر
      if (check.user.role === "MANAGER") {
        const allowedNextStatuses =
          MANAGER_ALLOWED_TRANSITIONS[before.status] || [];

        if (!allowedNextStatuses.includes(status)) {
          return {
            error:
              "شما اجازه این تغییر وضعیت را ندارید. منیجر فقط می‌تواند سفارش را مرحله‌به‌مرحله جلو ببرد.",
            statusCode: 403,
          };
        }
      }

      // اگر سفارش پرداخت‌شده به هر دلیل هنوز رزرو فعال داشته باشد،
      // رزرو را مصرف می‌کنیم؛ هرگز با لغو سفارش آن را آزاد نمی‌کنیم.
      if (before.stockReservationStatus === "RESERVED") {
        await consumeOrderStock(tx, before);
      }

      const order = await tx.order.update({
        where: { id: orderId },
        data: { status },
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
      });

      return {
        order,
        oldStatus: before.status,
      };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode },
      );
    }

    await logAction({
      userId: check.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "Order",
      entityId: String(orderId),
      description: `وضعیت سفارش #${orderId} از ${result.oldStatus} به ${status} تغییر کرد`,
      oldValue: { status: result.oldStatus },
      newValue: { status },
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
