import { prisma } from "@/lib/db";
import { ZARINPAL_GATEWAY_NAME } from "@/lib/zarinpal";
import {
  consumeOrderStock,
  getOrderStockEntries,
  tryReserveOrderStock,
} from "@/lib/stock-reservation";

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
  // Decrement by the purchased quantity; never delete quantities added after checkout.
  const wanted = new Map();
  for (const item of order.items) {
    if (Number.isSafeInteger(item.productId) && item.productId > 0) {
      wanted.set(item.productId, (wanted.get(item.productId) || 0) + Number(item.quantity));
    }
  }
  if (wanted.size === 0) return;
  const cart = await tx.cartItem.findMany({
    where: { userId: order.userId, productId: { in: [...wanted.keys()] } },
  });
  for (const ci of cart) {
    const remaining = ci.quantity - wanted.get(ci.productId);
    if (remaining > 0) {
      await tx.cartItem.update({ where: { id: ci.id }, data: { quantity: remaining } });
    } else {
      await tx.cartItem.delete({ where: { id: ci.id } });
    }
  }
}

async function createOrderFulfillments(tx, order) {
  if (
    !Array.isArray(order.items) ||
    order.items.length === 0
  ) {
    throw new Error("Order has no items for fulfillment");
  }

  // مالکیت تمام اقلام باید هنگام Checkout ثبت شده باشد.
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
    throw new Error(
      "Order supplier snapshot is incomplete",
    );
  }

  // جلوگیری از ساخت مرسوله تکراری
  const existingCount = await tx.orderFulfillment.count({
    where: {
      orderId: order.id,
    },
  });

  if (existingCount > 0) {
    throw new Error(
      "Fulfillments already exist for this order",
    );
  }

  const groups = new Map();

  for (const item of order.items) {
    if (
      !Number.isSafeInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      throw new Error(
        `Invalid fulfillment quantity for order item ${item.id}`,
      );
    }

    const supplierId = item.supplierId ?? null;

    // برای هر تأمین‌کننده یک کلید مستقل
    // کالاهای خود برجک با کلید BORJAK مشخص می‌شوند.
    const sellerKey = supplierId
      ? `SUPPLIER:${supplierId}`
      : "BORJAK";

    if (!groups.has(sellerKey)) {
      groups.set(sellerKey, {
        supplierId,
        sellerKey,
        items: [],
      });
    }

    groups.get(sellerKey).items.push({
      orderItemId: item.id,
      quantity: item.quantity,
    });
  }

  // هر تأمین‌کننده در هر سفارش فقط یک مرسوله دارد.
  for (const group of groups.values()) {
    await tx.orderFulfillment.create({
      data: {
        orderId: order.id,
        supplierId: group.supplierId,
        sellerKey: group.sellerKey,
        status: "PREPARING",
        shippingMethod: order.shippingMethod,
        shippingCost: 0,
        items: {
          create: group.items,
        },
      },
    });
  }
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
    let failureStage = "STOCK";

    try {
      if (latestOrder.status === "CANCELLED") {
        // سفارش قبلاً لغو شده؛ رزرو را آزاد می‌کنیم.
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
        await consumeOrderStock(tx, latestOrder);
      } else if (
        ["NONE", "RELEASED"].includes(
          latestOrder.stockReservationStatus,
        )
      ) {
        // پرداخت موفق پس از آزاد شدن رزرو
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

        await createOrderFulfillments(tx, latestOrder);
      }
    } catch (cause) {
      const isFulfillmentFailure =
        failureStage === "FULFILLMENT";

      const error = new Error(
        isFulfillmentFailure
          ? "Order fulfillment creation failed"
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
 * ثبت پرداخت موفق در حالتی که مصرف رزرو با خطا مواجه شده است.
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


/**
 * Settle a gateway-verified payment (shared by the callback route and the reconcile job).
 * Returns "SUCCESS" | "STOCK_ISSUE".
 */
export async function settlePaidOrder({ order, authority, refId }) {
  let outcome;
  try {
    outcome = await settleSuccessfulPayment({ order, authority, refId });
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
        ? "ZARINPAL_PAID_BUT_FULFILLMENT_CREATION_FAILED"
        : "ZARINPAL_PAID_BUT_STOCK_SETTLEMENT_FAILED",
      {
        orderId: order.id,
        authority,
        refId,
        message: settlementError.cause?.message,
      },
    );
    outcome = await recordPaidStockIssue({ order, authority, refId });
  }
  const latest = await prisma.order.findUnique({
    where: { id: order.id },
    select: { stockReservationStatus: true, stockIssueAt: true },
  });
  const issue = outcome === "STOCK_ISSUE" || latest?.stockReservationStatus === "ISSUE" || Boolean(latest?.stockIssueAt);
  await prisma.paymentAttempt.updateMany({
    where: { authority },
    data: { status: "PAID", refId: refId ?? undefined, note: issue ? "paid; stock issue - manual refund/review required" : null },
  }).catch(() => { });
  return issue ? "STOCK_ISSUE" : "SUCCESS";
}
