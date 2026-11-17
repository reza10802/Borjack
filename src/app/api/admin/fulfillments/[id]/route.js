
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, logAction } from "@/lib/auth";
import {
  FulfillmentStatus,
  PaymentStatus,
  OrderStatus,
} from "@/generated/prisma";

const MAX_TRACKING_LENGTH = 100;
const MAX_REASON_LENGTH = 500;
const MAX_ISSUE_NOTE_LENGTH = 1000;

function errorResponse(message, status = 400) {
  return NextResponse.json(
    { error: message },
    { status },
  );
}

function calculateOrderStatus(statuses) {
  if (!statuses.length) {
    return OrderStatus.PROCESSING;
  }

  if (
    statuses.every(
      (status) => status === FulfillmentStatus.DELIVERED,
    )
  ) {
    return OrderStatus.DELIVERED;
  }

  if (
    statuses.every((status) =>
      [
        FulfillmentStatus.SHIPPED,
        FulfillmentStatus.DELIVERED,
      ].includes(status),
    )
  ) {
    return OrderStatus.SHIPPED;
  }

  return OrderStatus.PROCESSING;
}

// PATCH /api/admin/fulfillments/[id]
export async function PATCH(req, { params }) {
  const auth = await requireAdmin();

  if (auth.error) {
    return auth.error;
  }

  try {
    const { id } = await params;
    const fulfillmentId = String(id ?? "").trim();

    if (!fulfillmentId || fulfillmentId.length > 128) {
      return errorResponse("شناسه مرسوله نامعتبر است");
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("اطلاعات ارسالی معتبر نیست");
    }

    const hasStatus = body.status !== undefined;
    const hasTrackingCode = body.trackingCode !== undefined;

    if (!hasStatus && !hasTrackingCode) {
      return errorResponse(
        "هیچ تغییری برای ثبت ارسال نشده است",
      );
    }

    const reason =
      typeof body.reason === "string"
        ? body.reason.trim()
        : "";

    // تمام تغییرات مدیریتی باید دلیل داشته باشند.
    if (
      !reason ||
      reason.length > MAX_REASON_LENGTH
    ) {
      return errorResponse(
        "ثبت دلیل تغییر برای عملیات مدیریتی الزامی است",
      );
    }

    let requestedStatus;

    if (hasStatus) {
      requestedStatus = body.status;

      if (
        !Object.values(FulfillmentStatus).includes(
          requestedStatus,
        )
      ) {
        return errorResponse("وضعیت مرسوله معتبر نیست");
      }
    }

    let trackingCode;

    if (hasTrackingCode) {
      if (typeof body.trackingCode !== "string") {
        return errorResponse("کد رهگیری معتبر نیست");
      }

      trackingCode = body.trackingCode.trim();

      if (
        !trackingCode ||
        trackingCode.length > MAX_TRACKING_LENGTH
      ) {
        return errorResponse("کد رهگیری معتبر نیست");
      }
    }

    let issueNote;

    if (requestedStatus === FulfillmentStatus.ISSUE) {
      if (typeof body.issueNote !== "string") {
        return errorResponse(
          "توضیح مشکل مرسوله الزامی است",
        );
      }

      issueNote = body.issueNote.trim();

      if (
        !issueNote ||
        issueNote.length > MAX_ISSUE_NOTE_LENGTH
      ) {
        return errorResponse(
          "توضیح مشکل معتبر نیست",
        );
      }
    }

    // ابتدا سفارش مرتبط را پیدا می‌کنیم.
    const target = await prisma.orderFulfillment.findUnique({
      where: {
        id: fulfillmentId,
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (!target) {
      return errorResponse("مرسوله پیدا نشد", 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      // ترتیب قفل‌گذاری هماهنگ با سایر مسیرهای سفارش
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

      const current = await tx.orderFulfillment.findUnique({
        where: {
          id: fulfillmentId,
        },
        include: {
          order: {
            select: {
              id: true,
              paymentStatus: true,
              status: true,
            },
          },
        },
      });

      if (!current) {
        return {
          error: "مرسوله پیدا نشد",
          statusCode: 404,
        };
      }

      if (
        current.order.paymentStatus !== PaymentStatus.PAID
      ) {
        return {
          error: "سفارش پرداخت نشده است",
          statusCode: 409,
        };
      }

      const nextStatus = hasStatus
        ? requestedStatus
        : current.status;

      const nextTrackingCode = hasTrackingCode
        ? trackingCode
        : current.trackingCode;

      if (
        nextStatus === current.status &&
        nextTrackingCode === current.trackingCode
      ) {
        return {
          error: "اطلاعات مرسوله تغییری نکرده است",
          statusCode: 400,
        };
      }

      if (
        nextStatus === FulfillmentStatus.SHIPPED &&
        !nextTrackingCode
      ) {
        return {
          error:
            "برای وضعیت ارسال‌شده، کد رهگیری الزامی است",
          statusCode: 400,
        };
      }

      const now = new Date();

      const reachedCarrier = [
        FulfillmentStatus.HANDED_TO_CARRIER,
        FulfillmentStatus.SHIPPED,
        FulfillmentStatus.DELIVERED,
      ].includes(nextStatus);

      const reachedShipped = [
        FulfillmentStatus.SHIPPED,
        FulfillmentStatus.DELIVERED,
      ].includes(nextStatus);

      const updateData = {};

      if (hasStatus) {
        updateData.status = nextStatus;

        // ISSUE بعد از رسیدگی ادمین پاک می‌شود.
        updateData.issueNote =
          nextStatus === FulfillmentStatus.ISSUE
            ? issueNote
            : null;

        updateData.handedOverAt = reachedCarrier
          ? current.handedOverAt ?? now
          : null;

        updateData.shippedAt = reachedShipped
          ? current.shippedAt ?? now
          : null;

        updateData.deliveredAt =
          nextStatus === FulfillmentStatus.DELIVERED
            ? current.deliveredAt ?? now
            : null;
      }

      if (hasTrackingCode) {
        updateData.trackingCode = trackingCode;

        if (!current.trackingCodeAddedAt) {
          updateData.trackingCodeAddedAt = now;
        }
      }

      const fulfillment = await tx.orderFulfillment.update({
        where: {
          id: fulfillmentId,
        },
        data: updateData,
      });

      // محاسبه وضعیت کلی سفارش از روی تمام مرسوله‌ها
      const allFulfillments =
        await tx.orderFulfillment.findMany({
          where: {
            orderId: target.orderId,
          },
          select: {
            status: true,
          },
        });

      const calculatedStatus = calculateOrderStatus(
        allFulfillments.map((item) => item.status),
      );

      let orderStatusUpdated = false;

      // سفارش لغوشده به‌صورت خودکار زنده نمی‌شود.
      if (current.order.status !== OrderStatus.CANCELLED) {
        const orderUpdate = await tx.order.updateMany({
          where: {
            id: target.orderId,
            paymentStatus: PaymentStatus.PAID,
            status: {
              not: OrderStatus.CANCELLED,
            },
          },
          data: {
            status: calculatedStatus,
          },
        });

        orderStatusUpdated = orderUpdate.count === 1;
      }

      return {
        fulfillment,
        oldStatus: current.status,
        oldTrackingCode: current.trackingCode,
        oldIssueNote: current.issueNote,
        newStatus: fulfillment.status,
        oldOrderStatus: current.order.status,
        newOrderStatus: calculatedStatus,
        orderStatusUpdated,
      };
    });

    if (result.error) {
      return errorResponse(
        result.error,
        result.statusCode,
      );
    }

    await logAction({
      userId: auth.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "ORDER_FULFILLMENT",
      entityId: fulfillmentId,
      description:
        `تغییر مدیریتی مرسوله سفارش #${target.orderId}: ${reason}`,
      oldValue: {
        status: result.oldStatus,
        trackingCode: result.oldTrackingCode,
        issueNote: result.oldIssueNote,
        orderStatus: result.oldOrderStatus,
      },
      newValue: {
        status: result.newStatus,
        trackingCode: result.fulfillment.trackingCode,
        issueNote: result.fulfillment.issueNote,
        orderStatus: result.newOrderStatus,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      fulfillment: result.fulfillment,
      orderStatus: result.newOrderStatus,
      orderStatusUpdated: result.orderStatusUpdated,
    });
  } catch (error) {
    console.error("ADMIN_FULFILLMENT_UPDATE_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در به‌روزرسانی مرسوله" },
      { status: 500 },
    );
  }
}
