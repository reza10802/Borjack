
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ZARINPAL_GATEWAY_NAME,
  ZARINPAL_VERIFY_URL,
  toZarinpalAmount,
} from "@/lib/zarinpal";
import {
  consumeOrderStock,
  getOrderStockEntries,
} from "@/lib/stock-reservation";

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site";

  try {
    return new URL(raw).origin;
  } catch {
    return "https://borjak.site";
  }
}

function getPaidRedirectPath(order) {
  return order.stockReservationStatus === "ISSUE" || order.stockIssueAt
    ? "/profile?payment=paid-stock-issue"
    : "/profile?payment=success";
}

async function lockAndGetOrder(tx, orderId, userId) {
  // ترتیب قفل‌گذاری با payment/request یکسان است.
  await tx.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;

  await tx.$queryRaw`
    SELECT "id"
    FROM "Order"
    WHERE "id" = ${orderId}
    FOR UPDATE
  `;

  return tx.order.findUnique({
    where: { id: orderId },
    include: {
      transaction: true,
      items: true,
    },
  });
}

/**
 * آزادسازی امن رزرو:
 * ابتدا تمام محصولات قفل و اعتبارسنجی می‌شوند.
 * اگر حتی یک محصول رزرو کافی نداشته باشد، هیچ موجودی‌ای تغییر نمی‌کند.
 */
async function releaseReservationSafely(tx, order) {
  if (order.stockReservationStatus !== "RESERVED") {
    return false;
  }

  const entries = getOrderStockEntries(order.items);

  // مرحله اول: قفل و بررسی تمام محصولات
  for (const entry of entries) {
    const rows = await tx.$queryRaw`
      SELECT
        "id",
        "reservedStock"
      FROM "Product"
      WHERE "id" = ${entry.productId}
      FOR UPDATE
    `;

    if (
      rows.length !== 1 ||
      Number(rows[0].reservedStock) < entry.quantity
    ) {
      return false;
    }
  }

  // مرحله دوم: آزادسازی تمام اقلام
  for (const entry of entries) {
    const updatedRows = await tx.$queryRaw`
      UPDATE "Product"
      SET "reservedStock" = "reservedStock" - ${entry.quantity}
      WHERE "id" = ${entry.productId}
        AND "reservedStock" >= ${entry.quantity}
      RETURNING "id"
    `;

    if (updatedRows.length !== 1) {
      throw new Error(
        `Stock reservation release failed for product ${entry.productId}`,
      );
    }
  }

  await tx.order.update({
    where: {
      id: order.id,
    },
    data: {
      stockReservationStatus: "RELEASED",
      paymentExpiresAt: null,
    },
  });

  return true;
}

async function removePurchasedCartItems(tx, order) {
  const productIds = [
    ...new Set(
      order.items
        .map((item) => item.productId)
        .filter(
          (id) => Number.isSafeInteger(id) && id > 0,
        ),
    ),
  ];

  if (productIds.length === 0) return;

  await tx.cartItem.deleteMany({
    where: {
      userId: order.userId,
      productId: {
        in: productIds,
      },
    },
  });
}

async function settleCanceledPayment({
  order,
  authority,
}) {
  return prisma.$transaction(async (tx) => {
    const latestOrder = await lockAndGetOrder(
      tx,
      order.id,
      order.userId,
    );

    if (!latestOrder) {
      return "INVALID";
    }

    if (latestOrder.paymentStatus === "PAID") {
      return getPaidRedirectPath(latestOrder) ===
        "/profile?payment=paid-stock-issue"
        ? "STOCK_ISSUE"
        : "PAID";
    }

    if (
      latestOrder.paymentStatus !== "PENDING" ||
      latestOrder.authority !== authority
    ) {
      return "INVALID";
    }

    const transaction = latestOrder.transaction;

    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(latestOrder.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      return "INVALID";
    }

    let stockIssue = false;

    if (
      latestOrder.stockReservationStatus === "RESERVED"
    ) {
      const released = await releaseReservationSafely(
        tx,
        latestOrder,
      );

      if (!released) {
        stockIssue = true;
      }
    } else if (
      !["NONE", "RELEASED"].includes(
        latestOrder.stockReservationStatus,
      )
    ) {
      stockIssue = true;
    }

    const transactionUpdate =
      await tx.transaction.updateMany({
        where: {
          orderId: latestOrder.id,
          authority,
          gateway: ZARINPAL_GATEWAY_NAME,
          status: {
            in: ["PENDING", "FAILED"],
          },
        },
        data: {
          status: "FAILED",
        },
      });

    if (transactionUpdate.count !== 1) {
      throw new Error(
        "Transaction state changed during cancellation",
      );
    }

    if (stockIssue) {
      await tx.order.update({
        where: {
          id: latestOrder.id,
        },
        data: {
          stockReservationStatus: "ISSUE",
          stockIssueAt: new Date(),
          paymentExpiresAt: null,
        },
      });

      console.error("ZARINPAL_CANCELED_STOCK_ISSUE", {
        orderId: latestOrder.id,
        authority,
        reservationStatus:
          latestOrder.stockReservationStatus,
      });

      return "CANCELED_STOCK_ISSUE";
    }

    return "CANCELED";
  });
}

async function settleSuccessfulPayment({
  order,
  authority,
  refId,
}) {
  return prisma.$transaction(async (tx) => {
    const latestOrder = await lockAndGetOrder(
      tx,
      order.id,
      order.userId,
    );

    if (!latestOrder) {
      throw new Error("Order not found during payment settlement");
    }

    // Callback تکراری یا هم‌زمان
    if (latestOrder.paymentStatus === "PAID") {
      return latestOrder.stockReservationStatus === "ISSUE" ||
        latestOrder.stockIssueAt
        ? "STOCK_ISSUE"
        : "PAID";
    }

    if (
      latestOrder.paymentStatus !== "PENDING" ||
      latestOrder.authority !== authority ||
      Number(latestOrder.total) !== Number(order.total)
    ) {
      throw new Error(
        "Order state changed before payment settlement",
      );
    }

    const transaction = latestOrder.transaction;

    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(latestOrder.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      throw new Error(
        "Transaction state changed before payment settlement",
      );
    }

    const transactionUpdate =
      await tx.transaction.updateMany({
        where: {
          orderId: latestOrder.id,
          authority,
          amount: latestOrder.total,
          gateway: ZARINPAL_GATEWAY_NAME,
          status: {
            in: ["PENDING", "FAILED"],
          },
        },
        data: {
          status: "SUCCESS",
          refId,
        },
      });

    if (transactionUpdate.count !== 1) {
      throw new Error(
        "Transaction could not be confirmed during settlement",
      );
    }

    let stockIssue = false;

    try {
      if (latestOrder.status === "CANCELLED") {
        // سفارش قبلاً لغو شده؛ موجودی رزروشده را آزاد می‌کنیم،
        // اما پرداخت موفق را برای رسیدگی علامت می‌زنیم.
        if (
          latestOrder.stockReservationStatus === "RESERVED"
        ) {
          const released = await releaseReservationSafely(
            tx,
            latestOrder,
          );

          if (!released) {
            stockIssue = true;
          }
        }

        stockIssue = true;
      } else if (
        latestOrder.stockReservationStatus === "RESERVED"
      ) {
        // فقط رزرو معتبر اجازه کاهش موجودی واقعی را دارد.
        await consumeOrderStock(tx, latestOrder);
      } else {
        // پرداخت موفق است ولی رزرو قابل مصرف وجود ندارد.
        stockIssue = true;
      }
    } catch (stockError) {
      const error = new Error(
        "Stock reservation settlement failed",
      );

      error.code = "STOCK_SETTLEMENT_FAILED";
      error.cause = stockError;

      throw error;
    }

    const orderData = {
      paymentStatus: "PAID",
      status: stockIssue ? "CANCELLED" : "PROCESSING",
      paidAt: latestOrder.paidAt ?? new Date(),
      refId,
      paymentExpiresAt: null,
    };

    if (stockIssue) {
      orderData.stockReservationStatus = "ISSUE";
      orderData.stockIssueAt = new Date();
    }

    const orderUpdate = await tx.order.updateMany({
      where: {
        id: latestOrder.id,
        authority,
        paymentStatus: "PENDING",
      },
      data: orderData,
    });

    if (orderUpdate.count !== 1) {
      throw new Error(
        "Order could not be marked as paid",
      );
    }

    await removePurchasedCartItems(tx, latestOrder);

    return stockIssue ? "STOCK_ISSUE" : "SUCCESS";
  });
}

/**
 * ثبت پرداخت موفق در حالتی که مصرف رزرو با خطا مواجه شده است.
 *
 * آزادسازی رزرو در این مرحله بهترین تلاش امن است.
 * اگر شمارنده‌ها ناسازگار باشند، رزرو را حدسی تغییر نمی‌دهیم
 * و سفارش برای بررسی دستی با ISSUE مشخص می‌شود.
 */
async function recordPaidStockIssue({
  order,
  authority,
  refId,
}) {
  return prisma.$transaction(async (tx) => {
    const latestOrder = await lockAndGetOrder(
      tx,
      order.id,
      order.userId,
    );

    if (!latestOrder) {
      throw new Error(
        "Order not found during stock issue handling",
      );
    }

    if (latestOrder.paymentStatus === "PAID") {
      return latestOrder.stockReservationStatus === "ISSUE" ||
        latestOrder.stockIssueAt
        ? "STOCK_ISSUE"
        : "PAID";
    }

    if (
      latestOrder.paymentStatus !== "PENDING" ||
      latestOrder.authority !== authority ||
      Number(latestOrder.total) !== Number(order.total)
    ) {
      throw new Error(
        "Order state changed during stock issue handling",
      );
    }

    const transaction = latestOrder.transaction;

    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(latestOrder.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      throw new Error(
        "Transaction is invalid during stock issue handling",
      );
    }

    let reservationReleased = true;

    if (
      latestOrder.stockReservationStatus === "RESERVED"
    ) {
      reservationReleased = await releaseReservationSafely(
        tx,
        latestOrder,
      );
    } else if (
      !["NONE", "RELEASED"].includes(
        latestOrder.stockReservationStatus,
      )
    ) {
      reservationReleased = false;
    }

    const transactionUpdate =
      await tx.transaction.updateMany({
        where: {
          orderId: latestOrder.id,
          authority,
          amount: latestOrder.total,
          gateway: ZARINPAL_GATEWAY_NAME,
          status: {
            in: ["PENDING", "FAILED"],
          },
        },
        data: {
          status: "SUCCESS",
          refId,
        },
      });

    if (transactionUpdate.count !== 1) {
      throw new Error(
        "Transaction could not be confirmed during stock issue handling",
      );
    }

    const orderUpdate = await tx.order.updateMany({
      where: {
        id: latestOrder.id,
        authority,
        paymentStatus: "PENDING",
      },
      data: {
        paymentStatus: "PAID",
        status: "CANCELLED",
        stockReservationStatus: "ISSUE",
        stockIssueAt: new Date(),
        paymentExpiresAt: null,
        paidAt: latestOrder.paidAt ?? new Date(),
        refId,
      },
    });

    if (orderUpdate.count !== 1) {
      throw new Error(
        "Order could not be marked as paid during stock issue handling",
      );
    }

    await removePurchasedCartItems(tx, latestOrder);

    if (!reservationReleased) {
      console.error("ZARINPAL_STOCK_RESERVATION_REQUIRES_RECONCILIATION", {
        orderId: latestOrder.id,
        authority,
        reservationStatus:
          latestOrder.stockReservationStatus,
      });
    }

    return "STOCK_ISSUE";
  });
}

export async function GET(req) {
  const siteUrl = getSiteUrl();

  const redirectTo = (path) =>
    NextResponse.redirect(new URL(path, siteUrl));

  let orderId = null;

  try {
    const { searchParams } = new URL(req.url);

    const authority = searchParams.get("Authority");
    const gatewayStatus = searchParams.get("Status");

    if (!authority || authority.length > 100) {
      return redirectTo("/?payment=failed");
    }

    const order = await prisma.order.findUnique({
      where: { authority },
      include: {
        transaction: true,
        items: true,
      },
    });

    if (!order) {
      return redirectTo("/?payment=order-not-found");
    }

    orderId = order.id;

    // Callback تکراری برای سفارش پرداخت‌شده
    if (order.paymentStatus === "PAID") {
      return redirectTo(getPaidRedirectPath(order));
    }

    if (order.paymentStatus !== "PENDING") {
      return redirectTo("/profile?payment=failed");
    }

    const transaction = order.transaction;

    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(order.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      console.error("ZARINPAL_TRANSACTION_MISMATCH", {
        orderId: order.id,
        transactionExists: Boolean(transaction),
        transactionGateway: transaction?.gateway,
        transactionStatus: transaction?.status,
        amountMatches: transaction
          ? Number(transaction.amount) === Number(order.total)
          : false,
        authorityMatches: transaction?.authority === authority,
      });

      return redirectTo("/profile?payment=verify-error");
    }

    // انصراف یا بازگشت ناموفق از درگاه
    if (gatewayStatus === "NOK") {
      const result = await settleCanceledPayment({
        order,
        authority,
      });

      if (result === "PAID") {
        const latestOrder = await prisma.order.findUnique({
          where: { id: order.id },
          select: {
            stockReservationStatus: true,
            stockIssueAt: true,
          },
        });

        return redirectTo(
          getPaidRedirectPath(latestOrder ?? {}),
        );
      }

      if (result === "STOCK_ISSUE") {
        return redirectTo("/profile?payment=paid-stock-issue");
      }

      if (result === "CANCELED_STOCK_ISSUE") {
        return redirectTo("/profile?payment=canceled-stock-issue");
      }

      if (result !== "CANCELED") {
        return redirectTo("/profile?payment=verify-error");
      }

      return redirectTo("/profile?payment=canceled");
    }

    if (gatewayStatus !== "OK") {
      console.error("ZARINPAL_UNKNOWN_CALLBACK_STATUS", {
        orderId: order.id,
        gatewayStatus,
      });

      // وضعیت نامشخص است؛ رزرو را آزاد نمی‌کنیم.
      return redirectTo("/profile?payment=verify-error");
    }

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;

    if (!merchantId) {
      console.error("ZARINPAL_MERCHANT_ID is missing");
      return redirectTo("/profile?payment=verify-error");
    }

    const amountRial = toZarinpalAmount(order.total);

    const response = await fetch(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        merchant_id: merchantId,
        authority,
        amount: amountRial,
      }),
    });

    const responseData = await response.json().catch(() => null);
    const result = responseData?.data;
    const code = Number(result?.code);

    // فقط کدهای 100 و 101 موفق محسوب می‌شوند.
    if (!response.ok || (code !== 100 && code !== 101)) {
      console.error("ZARINPAL_VERIFY_FAILED", {
        httpStatus: response.status,
        code: result?.code,
        errors: responseData?.errors,
        orderId: order.id,
      });

      // نتیجه نامشخص است؛ رزرو را آزاد نمی‌کنیم.
      return redirectTo("/profile?payment=verify-error");
    }

    const refId =
      result?.ref_id != null
        ? String(result.ref_id)
        : transaction.refId ?? order.refId ?? null;

    try {
      const settlementResult = await settleSuccessfulPayment({
        order,
        authority,
        refId,
      });

      if (settlementResult === "STOCK_ISSUE") {
        return redirectTo("/profile?payment=paid-stock-issue");
      }

      return redirectTo("/profile?payment=success");
    } catch (settlementError) {
      if (
        settlementError?.code !== "STOCK_SETTLEMENT_FAILED"
      ) {
        throw settlementError;
      }

      console.error("ZARINPAL_PAID_BUT_STOCK_SETTLEMENT_FAILED", {
        orderId: order.id,
        authority,
        refId,
        message: settlementError.cause?.message,
      });

      const fallbackResult = await recordPaidStockIssue({
        order,
        authority,
        refId,
      });

      if (fallbackResult === "PAID") {
        const latestOrder = await prisma.order.findUnique({
          where: { id: order.id },
          select: {
            stockReservationStatus: true,
            stockIssueAt: true,
          },
        });

        return redirectTo(
          getPaidRedirectPath(latestOrder ?? {}),
        );
      }

      return redirectTo("/profile?payment=paid-stock-issue");
    }
  } catch (error) {
    console.error("ZARINPAL_VERIFY_ERROR", {
      orderId,
      message: error?.message,
      code: error?.code,
    });

    // بررسی Callback هم‌زمان احتمالی
    if (orderId !== null) {
      try {
        const latestOrder = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            paymentStatus: true,
            stockReservationStatus: true,
            stockIssueAt: true,
          },
        });

        if (latestOrder?.paymentStatus === "PAID") {
          return redirectTo(getPaidRedirectPath(latestOrder));
        }
      } catch (readError) {
        console.error(
          "ZARINPAL_ORDER_STATUS_CHECK_FAILED",
          readError,
        );
      }
    }

    return redirectTo("/profile?payment=verify-error");
  }
}
