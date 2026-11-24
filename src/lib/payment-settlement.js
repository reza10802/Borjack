
import { prisma } from "@/lib/db";
import { ZARINPAL_GATEWAY_NAME } from "@/lib/zarinpal";
import {
  consumeOrderStock,
  getOrderStockEntries,
  tryReserveOrderStock,
} from "@/lib/stock-reservation";
import { sendAdminOrderNotificationSms } from "@/lib/sms";

const SHIPPING_METHODS = new Set(["POST", "POST_EXPRESS"]);
const SHIPPING_COST_PER_FULFILLMENT = 200_000;

export async function lockAndGetOrder(tx, orderId, userId) {
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
export async function releaseReservationSafely(tx, order) {
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
  // فقط تعداد خریداری‌شده کم می‌شود؛
  // تعدادهایی که بعد از Checkout به سبد اضافه شده‌اند باقی می‌مانند.
  const wanted = new Map();

  for (const item of order.items) {
    if (Number.isSafeInteger(item.productId) && item.productId > 0) {
      wanted.set(
        item.productId,
        (wanted.get(item.productId) || 0) + Number(item.quantity),
      );
    }
  }

  if (wanted.size === 0) return;

  const cart = await tx.cartItem.findMany({
    where: {
      userId: order.userId,
      productId: { in: [...wanted.keys()] },
    },
  });

  for (const cartItem of cart) {
    const remaining =
      cartItem.quantity - wanted.get(cartItem.productId);

    if (remaining > 0) {
      await tx.cartItem.update({
        where: { id: cartItem.id },
        data: { quantity: remaining },
      });
    } else {
      await tx.cartItem.delete({
        where: { id: cartItem.id },
      });
    }
  }
}

/**
 * اعتبارسنجی مرسوله‌هایی که هنگام ایجاد سفارش ساخته شده‌اند.
 *
 * این تابع عمداً هیچ مرسوله‌ای ایجاد یا اصلاح نمی‌کند.
 * اگر اطلاعات مرسوله‌ها ناقص یا ناسازگار باشد، پرداخت وارد مسیر بررسی دستی می‌شود.
 */
async function validateOrderFulfillments(tx, order) {
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("Order has no items for fulfillment");
  }

  const hasCompleteSnapshot = order.items.every(
    (item) =>
      item.supplierSnapshotCaptured === true &&
      (
        item.supplierId === null ||
        (
          typeof item.supplierId === "string" &&
          item.supplierId.trim().length > 0
        )
      ),
  );

  if (!hasCompleteSnapshot) {
    throw new Error("Order supplier snapshot is incomplete");
  }

  const expectedGroups = new Map();
  const expectedItems = new Map();

  let productSubtotal = 0;

  for (const item of order.items) {
    if (
      !Number.isSafeInteger(item.id) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0 ||
      !Number.isSafeInteger(item.price) ||
      item.price < 0
    ) {
      throw new Error(
        `Invalid order item data for item ${item.id}`,
      );
    }

    const supplierId = item.supplierId ?? null;
    const sellerKey = supplierId
      ? `SUPPLIER:${supplierId}`
      : "BORJAK";

    if (!expectedGroups.has(sellerKey)) {
      expectedGroups.set(sellerKey, {
        supplierId,
        sellerKey,
        items: new Map(),
      });
    }

    const group = expectedGroups.get(sellerKey);

    group.items.set(item.id, item.quantity);
    expectedItems.set(item.id, item.quantity);

    productSubtotal += item.price * item.quantity;

    if (!Number.isSafeInteger(productSubtotal)) {
      throw new Error("Order product subtotal is invalid");
    }
  }

  const fulfillments = await tx.orderFulfillment.findMany({
    where: {
      orderId: order.id,
    },
    include: {
      items: {
        select: {
          orderItemId: true,
          quantity: true,
        },
      },
    },
  });

  if (fulfillments.length !== expectedGroups.size) {
    throw new Error(
      "Order fulfillment count does not match seller groups",
    );
  }

  const seenSellerKeys = new Set();
  const seenOrderItemIds = new Set();

  let totalShippingCost = 0;

  for (const fulfillment of fulfillments) {
    if (
      !fulfillment.sellerKey ||
      seenSellerKeys.has(fulfillment.sellerKey)
    ) {
      throw new Error("Duplicate or invalid fulfillment seller key");
    }

    seenSellerKeys.add(fulfillment.sellerKey);

    const expectedGroup = expectedGroups.get(
      fulfillment.sellerKey,
    );

    if (!expectedGroup) {
      throw new Error(
        `Unexpected fulfillment seller ${fulfillment.sellerKey}`,
      );
    }

    if (
      (fulfillment.supplierId ?? null) !==
      expectedGroup.supplierId
    ) {
      throw new Error(
        `Fulfillment supplier mismatch for ${fulfillment.sellerKey}`,
      );
    }

    if (fulfillment.status !== "PREPARING") {
      throw new Error(
        `Unexpected fulfillment status for ${fulfillment.sellerKey}`,
      );
    }

    if (!SHIPPING_METHODS.has(fulfillment.shippingMethod)) {
      throw new Error(
        `Invalid shipping method for ${fulfillment.sellerKey}`,
      );
    }

    if (
      fulfillment.shippingCost !==
      SHIPPING_COST_PER_FULFILLMENT
    ) {
      throw new Error(
        `Invalid shipping cost for ${fulfillment.sellerKey}`,
      );
    }

    if (
      !Array.isArray(fulfillment.items) ||
      fulfillment.items.length !== expectedGroup.items.size
    ) {
      throw new Error(
        `Fulfillment item count mismatch for ${fulfillment.sellerKey}`,
      );
    }

    for (const fulfillmentItem of fulfillment.items) {
      const expectedQuantity = expectedGroup.items.get(
        fulfillmentItem.orderItemId,
      );

      if (
        expectedQuantity === undefined ||
        fulfillmentItem.quantity !== expectedQuantity ||
        seenOrderItemIds.has(fulfillmentItem.orderItemId)
      ) {
        throw new Error(
          `Invalid fulfillment item mapping for order item ${fulfillmentItem.orderItemId}`,
        );
      }

      seenOrderItemIds.add(fulfillmentItem.orderItemId);
    }

    totalShippingCost += fulfillment.shippingCost;
  }

  if (seenOrderItemIds.size !== expectedItems.size) {
    throw new Error("Some order items are missing from fulfillments");
  }

  if (
    !Number.isSafeInteger(order.shippingCost) ||
    totalShippingCost !== order.shippingCost
  ) {
    throw new Error("Order shipping cost does not match fulfillments");
  }

  const couponDiscount = Number(order.couponDiscount ?? 0);
  const gatewayFee = Number(order.gatewayFee ?? 0);

  if (
    !Number.isSafeInteger(couponDiscount) ||
    couponDiscount < 0 ||
    !Number.isSafeInteger(gatewayFee) ||
    gatewayFee < 0
  ) {
    throw new Error("Invalid order discount or gateway fee");
  }

  const expectedTotal =
    productSubtotal +
    totalShippingCost -
    couponDiscount +
    gatewayFee;

  if (
    !Number.isSafeInteger(expectedTotal) ||
    expectedTotal < 0 ||
    expectedTotal !== order.total
  ) {
    throw new Error("Order total does not match its financial breakdown");
  }

  return true;
}

export async function settleCanceledPayment({
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
      return (
        latestOrder.stockReservationStatus === "ISSUE" ||
        Boolean(latestOrder.stockIssueAt)
      )
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

    if (latestOrder.stockReservationStatus === "RESERVED") {
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

    const transactionUpdate = await tx.transaction.updateMany({
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

export async function settleSuccessfulPayment({
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

    const transactionUpdate = await tx.transaction.updateMany({
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
    let failureStage = "STOCK";

    try {
      if (latestOrder.status === "CANCELLED") {
        // سفارش قبلاً لغو شده؛ رزرو را آزاد می‌کنیم.
        if (latestOrder.stockReservationStatus === "RESERVED") {
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
        await consumeOrderStock(tx, latestOrder);
      } else if (
        ["NONE", "RELEASED"].includes(
          latestOrder.stockReservationStatus,
        )
      ) {
        // پرداخت موفق پس از آزاد شدن رزرو:
        // تلاش برای رزرو مجدد و مصرف اتمیک موجودی
        const reserved = await tryReserveOrderStock(
          tx,
          latestOrder,
          new Date(Date.now() + 60 * 1000),
        );

        if (reserved) {
          await consumeOrderStock(tx, {
            ...latestOrder,
            stockReservationStatus: "RESERVED",
          });
        } else {
          stockIssue = true;
        }
      } else {
        stockIssue = true;
      }

      if (!stockIssue) {
        failureStage = "FULFILLMENT";

        // مرسوله‌ها قبلاً در زمان ثبت سفارش ساخته شده‌اند.
        // اینجا فقط صحت آن‌ها بررسی می‌شود.
        await validateOrderFulfillments(tx, latestOrder);
      }
    } catch (cause) {
      const isFulfillmentFailure =
        failureStage === "FULFILLMENT";

      const error = new Error(
        isFulfillmentFailure
          ? "Order fulfillment validation failed"
          : "Stock reservation settlement failed",
      );

      error.code = isFulfillmentFailure
        ? "FULFILLMENT_CREATION_FAILED"
        : "STOCK_SETTLEMENT_FAILED";

      error.cause = cause;

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
 * ثبت پرداخت موفق در حالتی که مصرف رزرو یا اعتبارسنجی مرسوله
 * با خطا مواجه شده است.
 *
 * آزادسازی رزرو در این مرحله بهترین تلاش امن است.
 * اگر شمارنده‌ها ناسازگار باشند، رزرو را حدسی تغییر نمی‌دهیم
 * و سفارش برای بررسی دستی با ISSUE مشخص می‌شود.
 */
export async function recordPaidStockIssue({
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

    if (latestOrder.stockReservationStatus === "RESERVED") {
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

    const transactionUpdate = await tx.transaction.updateMany({
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
      console.error(
        "ZARINPAL_STOCK_RESERVATION_REQUIRES_RECONCILIATION",
        {
          orderId: latestOrder.id,
          authority,
          reservationStatus:
            latestOrder.stockReservationStatus,
        },
      );
    }

    return "STOCK_ISSUE";
  });
}

/**
 * Settle a gateway-verified payment
 * (shared by the callback route and the reconcile job).
 *
 * Returns "SUCCESS" | "STOCK_ISSUE".
 */
export async function settlePaidOrder({
  order,
  authority,
  refId,
}) {
  let outcome;

  try {
    outcome = await settleSuccessfulPayment({
      order,
      authority,
      refId,
    });
  } catch (settlementError) {
    const failureCode = settlementError?.code;

    if (
      ![
        "STOCK_SETTLEMENT_FAILED",
        "FULFILLMENT_CREATION_FAILED",
      ].includes(failureCode)
    ) {
      throw settlementError;
    }

    console.error(
      failureCode === "FULFILLMENT_CREATION_FAILED"
        ? "ZARINPAL_PAID_BUT_FULFILLMENT_VALIDATION_FAILED"
        : "ZARINPAL_PAID_BUT_STOCK_SETTLEMENT_FAILED",
      {
        orderId: order.id,
        authority,
        refId,
        message: settlementError.cause?.message,
      },
    );

    outcome = await recordPaidStockIssue({
      order,
      authority,
      refId,
    });
  }

  const latest = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      stockReservationStatus: true,
      stockIssueAt: true,
    },
  });

  const issue =
    outcome === "STOCK_ISSUE" ||
    latest?.stockReservationStatus === "ISSUE" ||
    Boolean(latest?.stockIssueAt);

  await prisma.paymentAttempt.updateMany({
    where: { authority },
    data: {
      status: "PAID",
      refId: refId ?? undefined,
      note: issue
        ? "paid; stock issue - manual refund/review required"
        : null,
    },
  }).catch(() => { });

  // ارسال پیامک اطلاع‌رسانی پس از ثبت قطعی پرداخت
  // خطای SMS نباید نتیجه پرداخت را تغییر دهد.
  try {
    await sendAdminOrderNotificationSms(order.id);
  } catch (smsError) {
    console.error("ADMIN_ORDER_SMS_UNEXPECTED_ERROR", {
      orderId: order.id,
      code: smsError?.code,
    });
  }

  return issue ? "STOCK_ISSUE" : "SUCCESS";
}
