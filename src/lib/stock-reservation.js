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
// Re-reserve stock for an order that already has a verified payment (late callback after release).
// Locks every product first and verifies ALL lines, so nothing is changed unless the whole order fits.
export async function tryReserveOrderStock(tx, order, expiresAt) {
  if (!["NONE", "RELEASED"].includes(order.stockReservationStatus)) return false;
  const entries = getOrderStockEntries(order.items);
  for (const entry of entries) {
    const rows = await tx.$queryRaw`
      SELECT "stock", "reservedStock", "isPublished", "deletedAt"
      FROM "Product" WHERE "id" = ${entry.productId} FOR UPDATE`;
    const r = rows[0];
    if (!r || r.deletedAt || !r.isPublished || Number(r.stock) - Number(r.reservedStock) < entry.quantity) {
      return false;
    }
  }
  await reserveOrderStock(tx, order, expiresAt);
  return true;
}

// Return consumed stock of an eligible cancelled order. Idempotent via Order.stockRestockedAt.
export async function restockOrderStock(tx, order) {
  if (order.stockReservationStatus !== "CONSUMED" || order.stockRestockedAt) return false;
  const entries = getOrderStockEntries(order.items);
  for (const entry of entries) {
    const rows = await tx.$queryRaw`
      UPDATE "Product" SET "stock" = "stock" + ${entry.quantity}
      WHERE "id" = ${entry.productId} RETURNING "id"`;
    if (rows.length !== 1) throw new StockReservationIntegrityError(entry.productId);
  }
  await tx.order.update({
    where: { id: order.id },
    data: { stockRestockedAt: new Date(), stockReservationStatus: "RELEASED" },
  });
  return true;
}

// Restore inventory when an already-paid order is cancelled by an admin.
// RESERVED means stock was only held, so release the hold without changing stock.
// CONSUMED means stock was deducted at settlement, so add it back exactly once.
export async function restoreOrderStockForCancellation(tx, order) {
  if (order.stockReservationStatus === "RESERVED") {
    return {
      restocked: false,
      reservationReleased: await releaseOrderStock(tx, order),
    };
  }

  if (order.stockReservationStatus === "CONSUMED") {
    return {
      restocked: await restockOrderStock(tx, order),
      reservationReleased: false,
    };
  }

  return { restocked: false, reservationReleased: false };
}

// Prices on the order are a snapshot; reservation/payment must not go through if they drifted.
export async function findPriceMismatches(tx, order) {
  const ids = [...new Set(order.items.map((i) => i.productId))];
  const products = await tx.product.findMany({ where: { id: { in: ids } }, select: { id: true, price: true, title: true } });
  const current = new Map(products.map((p) => [p.id, p]));
  return order.items
    .filter((i) => Number(current.get(i.productId)?.price) !== Number(i.price))
    .map((i) => ({ productId: i.productId, title: current.get(i.productId)?.title ?? null }));
}
