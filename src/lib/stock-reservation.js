export class StockUnavailableError extends Error {
  constructor(productId) {
    super(`Insufficient available stock for product ${productId}`);
    this.name = "StockUnavailableError";
    this.code = "STOCK_UNAVAILABLE";
    this.productId = productId;
  }
}

export class StockReservationIntegrityError extends Error {
  constructor(productId) {
    super(`Stock reservation inconsistency for product ${productId}`);
    this.name = "StockReservationIntegrityError";
    this.code = "STOCK_RESERVATION_INTEGRITY";
    this.productId = productId;
  }
}

export function getOrderStockEntries(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order has no items");
  }

  const quantities = new Map();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error("Invalid order item");
    }

    const total = (quantities.get(productId) || 0) + quantity;

    if (!Number.isSafeInteger(total)) {
      throw new Error("Invalid aggregated product quantity");
    }

    quantities.set(productId, total);
  }

  return [...quantities.entries()]
    .sort(([a], [b]) => a - b)
    .map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
}

// رزرو موجودی پیش از انتقال مشتری به درگاه
export async function reserveOrderStock(tx, order, expiresAt) {
  if (order.stockReservationStatus === "RESERVED") {
    return;
  }

  if (
    !["NONE", "RELEASED"].includes(
      order.stockReservationStatus,
    )
  ) {
    throw new Error("Order cannot reserve stock in current state");
  }

  const entries = getOrderStockEntries(order.items);

  for (const entry of entries) {
    const updatedRows = await tx.$queryRaw`
      UPDATE "Product"
      SET "reservedStock" = "reservedStock" + ${entry.quantity}
      WHERE "id" = ${entry.productId}
        AND "deletedAt" IS NULL
        AND "isPublished" = TRUE
        AND "stock" - "reservedStock" >= ${entry.quantity}
      RETURNING "id"
    `;

    if (updatedRows.length !== 1) {
      throw new StockUnavailableError(entry.productId);
    }
  }

  await tx.order.update({
    where: {
      id: order.id,
    },
    data: {
      stockReservationStatus: "RESERVED",
      paymentExpiresAt: expiresAt,
    },
  });
}

// آزادسازی رزرو پس از انصراف قطعی یا شکست پرداخت
export async function releaseOrderStock(tx, order) {
  if (order.stockReservationStatus !== "RESERVED") {
    return false;
  }

  const entries = getOrderStockEntries(order.items);

  for (const entry of entries) {
    const updatedRows = await tx.$queryRaw`
      UPDATE "Product"
      SET "reservedStock" = "reservedStock" - ${entry.quantity}
      WHERE "id" = ${entry.productId}
        AND "reservedStock" >= ${entry.quantity}
      RETURNING "id"
    `;

    if (updatedRows.length !== 1) {
      throw new StockReservationIntegrityError(entry.productId);
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

// تبدیل رزرو به فروش قطعی پس از تأیید پرداخت
export async function consumeOrderStock(tx, order) {
  if (order.stockReservationStatus !== "RESERVED") {
    throw new Error("Order does not have an active stock reservation");
  }

  const entries = getOrderStockEntries(order.items);

  for (const entry of entries) {
    const updatedRows = await tx.$queryRaw`
      UPDATE "Product"
      SET
        "stock" = "stock" - ${entry.quantity},
        "reservedStock" = "reservedStock" - ${entry.quantity}
      WHERE "id" = ${entry.productId}
        AND "stock" >= ${entry.quantity}
        AND "reservedStock" >= ${entry.quantity}
      RETURNING "id"
    `;

    if (updatedRows.length !== 1) {
      throw new StockReservationIntegrityError(entry.productId);
    }
  }

  await tx.order.update({
    where: {
      id: order.id,
    },
    data: {
      stockReservationStatus: "CONSUMED",
      paymentExpiresAt: null,
    },
  });
}