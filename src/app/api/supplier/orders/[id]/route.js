
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSupplier, logAction } from "@/lib/auth";
import {
  FulfillmentStatus,
  PaymentStatus,
  OrderStatus,
} from "@/generated/prisma";

const NEXT_STATUS = {
  [FulfillmentStatus.PREPARING]:
    FulfillmentStatus.READY_FOR_HANDOVER,

  [FulfillmentStatus.READY_FOR_HANDOVER]:
    FulfillmentStatus.HANDED_TO_CARRIER,

  [FulfillmentStatus.HANDED_TO_CARRIER]:
    FulfillmentStatus.SHIPPED,
};

const MAX_TRACKING_CODE_LENGTH = 100;
const MAX_ISSUE_NOTE_LENGTH = 1000;

const badRequest = (error, status = 400) =>
  NextResponse.json({ error }, { status });

// PATCH /api/supplier/orders/[id]
// ID refers to OrderFulfillment, not the parent Order.
export async function PATCH(req, { params }) {
  const auth = await requireSupplier();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { id } = await params;
    const fulfillmentId = String(id ?? "").trim();

    if (!fulfillmentId || fulfillmentId.length > 128) {
      return badRequest("شناسه مرسوله نامعتبر است");
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("اطلاعات ارسالی معتبر نیست");
    }

    const requestedStatus = body.status;

    if (!Object.values(FulfillmentStatus).includes(requestedStatus)) {
      return badRequest("وضعیت مرسوله معتبر نیست");
    }

    // تأمین‌کننده اجازه ثبت تحویل نهایی را ندارد.
    if (requestedStatus === FulfillmentStatus.DELIVERED) {
      return badRequest(
        "وضعیت تحویل نهایی از طریق استعلام پست یا ادمین ثبت می‌شود.",
        403,
      );
    }

    let trackingCode = null;

    if (body.trackingCode !== undefined) {
      if (typeof body.trackingCode !== "string") {
        return badRequest("کد رهگیری معتبر نیست");
      }

      trackingCode = body.trackingCode.trim();

      if (
        !trackingCode ||
        trackingCode.length > MAX_TRACKING_CODE_LENGTH
      ) {
        return badRequest("کد رهگیری معتبر نیست");
      }
    }

    let issueNote = null;

    if (requestedStatus === FulfillmentStatus.ISSUE) {
      if (typeof body.issueNote !== "string") {
        return badRequest("توضیح مشکل الزامی است");
      }

      issueNote = body.issueNote.trim();

      if (
        !issueNote ||
        issueNote.length > MAX_ISSUE_NOTE_LENGTH
      ) {
        return badRequest("توضیح مشکل معتبر نیست");
      }
    } else if (body.trackingCode !== undefined && requestedStatus !== FulfillmentStatus.SHIPPED) {
      return badRequest(
        "کد رهگیری فقط هنگام ثبت وضعیت ارسال‌شده ثبت می‌شود.",
      );
    }

    // بررسی اولیه مالکیت مرسوله.
    // شناسه مرسوله متعلق به فروشنده دیگر قابل مشاهده نیست.
    const target = await prisma.orderFulfillment.findFirst({
      where: {
        id: fulfillmentId,
        supplierId: auth.user.id,
        order: {
          is: {
            paymentStatus: PaymentStatus.PAID,
            status: {
              not: OrderStatus.CANCELLED,
            },
          },
        },
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (!target) {
      return badRequest("مرسوله پیدا نشد", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      // ترتیب قفل‌گذاری: کاربر، سفارش، مرسوله
      await tx.$queryRaw`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${auth.user.id}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${target.orderId}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "OrderFulfillment"
        WHERE "id" = ${fulfillmentId}
        FOR UPDATE
      `;

      // اعتبارسنجی مجدد مالکیت و وضعیت پس از گرفتن قفل
      const current = await tx.orderFulfillment.findFirst({
        where: {
          id: fulfillmentId,
          orderId: target.orderId,
          supplierId: auth.user.id,
          order: {
            is: {
              paymentStatus: PaymentStatus.PAID,
              status: {
                not: OrderStatus.CANCELLED,
              },
            },
          },
        },
        select: {
          id: true,
          orderId: true,
          status: true,
          trackingCode: true,
          trackingCodeAddedAt: true,
        },
      });

      if (!current) {
        return {
          error: "مرسوله پیدا نشد",
          statusCode: 404,
        };
      }

      if (current.status === FulfillmentStatus.DELIVERED) {
        return {
          error: "مرسوله تحویل نهایی شده و قابل تغییر نیست.",
          statusCode: 409,
        };
      }

      if (current.status === FulfillmentStatus.ISSUE) {
        return {
          error:
            "این مرسوله دارای مشکل است. ادامه فرایند باید توسط ادمین انجام شود.",
          statusCode: 409,
        };
      }

      if (current.status === FulfillmentStatus.SHIPPED) {
        return {
          error:
            "مرسوله ارسال شده است. برای اصلاح اطلاعات آن با ادمین هماهنگ کنید.",
          statusCode: 409,
        };
      }

      const isIssue = requestedStatus === FulfillmentStatus.ISSUE;

      // ISSUE یک مسیر استثنایی است و نیاز به دلیل دارد.
      if (isIssue) {
        if (
          [
            FulfillmentStatus.SHIPPED,
            FulfillmentStatus.DELIVERED,
            FulfillmentStatus.ISSUE,
          ].includes(current.status)
        ) {
          return {
            error: "ثبت مشکل برای این وضعیت مجاز نیست.",
            statusCode: 409,
          };
        }
      } else {
        // جلوگیری از پرش مراحل
        const expectedNext = NEXT_STATUS[current.status];

        if (requestedStatus !== expectedNext) {
          return {
            error:
              "تغییر وضعیت باید دقیقاً طبق ترتیب مراحل ارسال انجام شود.",
            statusCode: 409,
          };
        }
      }

      const now = new Date();

      const updateData = {
        status: requestedStatus,
      };

      if (isIssue) {
        updateData.issueNote = issueNote;
      } else {
        updateData.issueNote = null;
      }

      if (requestedStatus === FulfillmentStatus.HANDED_TO_CARRIER) {
        updateData.handedOverAt = now;
      }

      if (requestedStatus === FulfillmentStatus.SHIPPED) {
        // کد رهگیری باید قبل از ارسال در دسترس باشد.
        const finalTrackingCode =
          trackingCode || current.trackingCode;

        if (!finalTrackingCode) {
          return {
            error:
              "برای ثبت وضعیت ارسال‌شده، کد رهگیری الزامی است.",
            statusCode: 400,
          };
        }

        // تأمین‌کننده اجازه اصلاح کد ثبت‌شده را ندارد.
        if (
          current.trackingCode &&
          trackingCode &&
          current.trackingCode !== trackingCode
        ) {
          return {
            error:
              "کد رهگیری قبلاً ثبت شده است. برای اصلاح آن با ادمین هماهنگ کنید.",
            statusCode: 409,
          };
        }

        updateData.trackingCode = finalTrackingCode;
        updateData.trackingCodeAddedAt =
          current.trackingCodeAddedAt ?? now;
        updateData.shippedAt = now;
      }

      const fulfillment = await tx.orderFulfillment.update({
        where: {
          id: fulfillmentId,
        },
        data: updateData,
      });

      let orderStatusUpdated = false;

      // فقط وقتی تمام مرسوله‌ها ارسال شده باشند،
      // وضعیت کلی سفارش به SHIPPED تغییر می‌کند.
      if (requestedStatus === FulfillmentStatus.SHIPPED) {
        const allFulfillments =
          await tx.orderFulfillment.findMany({
            where: {
              orderId: current.orderId,
            },
            select: {
              status: true,
            },
          });

        const allShipped =
          allFulfillments.length > 0 &&
          allFulfillments.every((item) =>
            [
              FulfillmentStatus.SHIPPED,
              FulfillmentStatus.DELIVERED,
            ].includes(item.status),
          );

        if (allShipped) {
          const orderUpdate = await tx.order.updateMany({
            where: {
              id: current.orderId,
              paymentStatus: PaymentStatus.PAID,
              status: {
                notIn: [
                  OrderStatus.DELIVERED,
                  OrderStatus.CANCELLED,
                ],
              },
            },
            data: {
              status: OrderStatus.SHIPPED,
            },
          });

          orderStatusUpdated = orderUpdate.count === 1;
        }
      }

      return {
        fulfillment,
        oldStatus: current.status,
        newStatus: requestedStatus,
        orderStatusUpdated,
      };
    });

    if (result.error) {
      return badRequest(
        result.error,
        result.statusCode,
      );
    }

    // ثبت تاریخچه عملیات تأمین‌کننده
    await logAction({
      userId: auth.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "ORDER_FULFILLMENT",
      entityId: fulfillmentId,
      description:
        `وضعیت مرسوله سفارش #${target.orderId} از ${result.oldStatus} به ${result.newStatus} تغییر کرد`,
      oldValue: {
        status: result.oldStatus,
      },
      newValue: {
        status: result.newStatus,
        trackingCodeAdded:
          result.fulfillment.trackingCode !== null,
        orderStatusUpdated: result.orderStatusUpdated,
        ...(result.newStatus === FulfillmentStatus.ISSUE
          ? { issueNote }
          : {}),
      },
    });

    if (requestedStatus === FulfillmentStatus.ISSUE) {
      console.warn("SUPPLIER_FULFILLMENT_ISSUE_REPORTED", {
        orderId: target.orderId,
        fulfillmentId,
        supplierId: auth.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      fulfillment: result.fulfillment,
      orderStatusUpdated: result.orderStatusUpdated,
    });
  } catch (error) {
    console.error("SUPPLIER_FULFILLMENT_UPDATE_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در به‌روزرسانی مرسوله" },
      { status: 500 },
    );
  }
}
