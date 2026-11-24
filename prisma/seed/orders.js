
import { MS, addMs, minDate, assertInt32 } from "./_lib.js";
import { calculateProductPricing } from "../../src/lib/pricing.js";

// Orders mirror the current checkout, payment settlement and stock models.
// Product.stock already reflects consumed sales.
// Only RESERVED orders contribute to Product.reservedStock.

const MAX_ORDER_TOTAL = 1_500_000_000;
const BIG_TICKET = 50_000_000;
const DAY = 24 * 60;

const SHIPPING_COST_PER_FULFILLMENT = 200_000;
const SHIPPING_METHODS = ["POST", "POST_EXPRESS"];
const BORJAK_SELLER_KEY = "BORJAK";

const SCENARIOS = [
  {
    key: "DELIVERED",
    count: 24,
    age: [10 * DAY, 90 * DAY],
    status: "DELIVERED",
    payment: "PAID",
    stock: "CONSUMED",
    tx: "SUCCESS",
    attempt: "PAID",
    shipped: true,
    delivered: true,
    historical: true,
  },
  {
    key: "SHIPPED",
    count: 7,
    age: [3 * DAY, 9 * DAY],
    status: "SHIPPED",
    payment: "PAID",
    stock: "CONSUMED",
    tx: "SUCCESS",
    attempt: "PAID",
    shipped: true,
  },
  {
    key: "READY_TO_SHIP",
    count: 5,
    age: [1 * DAY, 3 * DAY],
    status: "READY_TO_SHIP",
    payment: "PAID",
    stock: "CONSUMED",
    tx: "SUCCESS",
    attempt: "PAID",
  },
  {
    key: "PROCESSING",
    count: 6,
    age: [60, 2 * DAY],
    status: "PROCESSING",
    payment: "PAID",
    stock: "CONSUMED",
    tx: "SUCCESS",
    attempt: "PAID",
  },
  {
    key: "AWAITING_PAYMENT",
    count: 2,
    age: [3, 10],
    status: "PENDING",
    payment: "PENDING",
    stock: "RESERVED",
    tx: "PENDING",
    attempt: "PENDING",
    expiresInMinutes: [5, 12],
  },
  {
    key: "EXPIRED_RESERVATION",
    count: 1,
    age: [100, 130],
    status: "PENDING",
    payment: "PENDING",
    stock: "RESERVED",
    tx: "PENDING",
    attempt: "PENDING",
    expiredMinutesAgo: [40, 60],
  },
  {
    key: "NEEDS_REVIEW",
    count: 1,
    age: [150, 200],
    status: "PENDING",
    payment: "PENDING",
    stock: "RESERVED",
    tx: "PENDING",
    attempt: "REVIEW",
    expiredMinutesAgo: [90, 120],
    note: "reconciliation inconclusive - manual review required",
  },
  {
    key: "NOT_STARTED",
    count: 2,
    age: [5, 90],
    status: "PENDING",
    payment: "PENDING",
    stock: "NONE",
  },
  {
    key: "USER_CANCELLED",
    count: 4,
    age: [2 * DAY, 40 * DAY],
    status: "CANCELLED",
    payment: "FAILED",
    stock: "NONE",
    noAuthority: true,
  },
  {
    key: "PAYMENT_EXPIRED",
    count: 3,
    age: [1 * DAY, 30 * DAY],
    status: "PENDING",
    payment: "PENDING",
    stock: "RELEASED",
    tx: "FAILED",
    attempt: "EXPIRED",
    note: "expired; ZarinPal Inquiry status FAILED",
  },
  {
    key: "CANCELLED_AFTER_PAYMENT",
    count: 3,
    age: [5 * DAY, 50 * DAY],
    status: "CANCELLED",
    payment: "PAID",
    stock: "RELEASED",
    tx: "SUCCESS",
    attempt: "PAID",
    restocked: true,
    historical: true,
  },
  {
    key: "PAID_STOCK_ISSUE",
    count: 2,
    age: [1 * DAY, 20 * DAY],
    status: "CANCELLED",
    payment: "PAID",
    stock: "ISSUE",
    tx: "SUCCESS",
    attempt: "PAID",
    stockIssue: true,
    note: "paid; stock issue - manual refund/review required",
  },
];

const authorityFor = (n) =>
  `A${String(n).padStart(35, "0")}`;

function digits(rng, n) {
  return Array.from({ length: n }, () => rng.int(0, 9)).join("");
}

function trackingCodeFor(rng) {
  return digits(rng, 20);
}

function getSupplierId(product) {
  return (
    typeof product?.supplierId === "string" &&
    product.supplierId.trim()
  )
    ? product.supplierId
    : null;
}

/**
 * Uses the same pricing engine and financial snapshot rules as checkout.
 * All prices and financial fields are in Toman, per unit.
 */
function getProductFinancialSnapshot(product) {
  const price = Number(product?.price);
  const originalPrice = Number(product?.originalPrice);

  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(originalPrice) ||
    originalPrice <= 0
  ) {
    throw new Error(
      `[seed] invalid product price for product ${product?.id}`,
    );
  }

  const supplierId = getSupplierId(product);

  const basePrice =
    product.basePrice == null
      ? null
      : Number(product.basePrice);

  let pricing = null;

  if (basePrice !== null) {
    pricing = calculateProductPricing({
      basePrice,
      discount: Number(product.discount ?? 0),
    });

    if (
      pricing.price !== price ||
      pricing.originalPrice !== originalPrice ||
      pricing.commissionPercent !==
      Number(product.commissionPercent)
    ) {
      throw new Error(
        `[seed] product pricing mismatch for product ${product.id}`,
      );
    }
  }

  if (supplierId && !pricing) {
    throw new Error(
      `[seed] supplier product ${product.id} has no pricing snapshot`,
    );
  }

  const commissionPercent =
    pricing?.commissionPercent ??
    (
      Number.isSafeInteger(Number(product.commissionPercent))
        ? Number(product.commissionPercent)
        : null
    );

  const hasSellerPricing =
    supplierId !== null && pricing !== null;

  const supplierPayout = hasSellerPricing
    ? pricing.supplierPayoutPrice
    : null;

  const commissionAmount = hasSellerPricing
    ? price - supplierPayout
    : null;

  if (
    hasSellerPricing &&
    (
      !Number.isSafeInteger(commissionAmount) ||
      commissionAmount < 0
    )
  ) {
    throw new Error(
      `[seed] invalid commission amount for product ${product.id}`,
    );
  }

  return {
    price,
    supplierId,

    basePriceAtPurchase: basePrice,
    commissionPercentAtPurchase: commissionPercent,
    originalPriceAtPurchase: originalPrice,

    supplierDiscountPercentAtPurchase:
      hasSellerPricing ? pricing.discount : null,

    supplierDiscountAmountAtPurchase:
      hasSellerPricing ? pricing.supplierDiscountAmount : null,

    supplierPayoutAtPurchase: supplierPayout,
    commissionAmountAtPurchase: commissionAmount,

    supplierSnapshotCaptured: true,
  };
}

function buildItems({
  rng,
  products,
  scenario,
  reservedSoFar,
  forced,
}) {
  const reserving = scenario.stock === "RESERVED";

  let pool = products.filter(
    (product) =>
      (
        product.isPublished &&
        !product.deletedAt
      ) ||
      (
        scenario.historical &&
        product.isPublished &&
        product.deletedAt
      ),
  );

  if (reserving) {
    pool = pool.filter(
      (product) =>
        !product.deletedAt &&
        product.stock -
        (reservedSoFar.get(product.id) || 0) >= 1,
    );
  }

  const forcedList = forced
    ? [].concat(forced)
    : [];

  for (const product of forcedList) {
    if (!product) {
      throw new Error(
        `[seed] forced product is missing for scenario ${scenario.key}`,
      );
    }
  }

  const wanted = Math.max(
    rng.weighted([
      [1, 45],
      [2, 30],
      [3, 15],
      [4, 10],
    ]),
    forcedList.length,
  );

  const lines = [];
  let total = 0;

  const ordered = [
    ...forcedList,
    ...rng.shuffle(
      pool.filter(
        (product) => !forcedList.includes(product),
      ),
    ),
  ];

  for (const product of ordered) {
    if (lines.length >= wanted) break;

    let quantity =
      product.price >= BIG_TICKET
        ? (rng.chance(0.15) ? 2 : 1)
        : rng.int(1, 3);

    if (reserving) {
      const available =
        product.stock -
        (reservedSoFar.get(product.id) || 0);

      quantity = Math.min(quantity, available);

      if (quantity < 1) continue;
    }

    const unitPrice = Number(product.price);
    const lineTotal = unitPrice * quantity;

    if (
      !Number.isSafeInteger(lineTotal) ||
      total + lineTotal > MAX_ORDER_TOTAL
    ) {
      continue;
    }

    lines.push({
      productId: product.id,
      quantity,
      price: unitPrice,
    });

    total += lineTotal;
  }

  if (!lines.length) {
    throw new Error(
      `[seed] could not build items for scenario ${scenario.key}`,
    );
  }

  return {
    lines,
    total: assertInt32(
      total,
      `${scenario.key} product subtotal`,
    ),
  };
}

/**
 * Groups order lines by the seller captured from Product ownership.
 * BORJAK-owned items get their own fulfillment.
 */
function buildFulfillmentGroups(lines, productMap) {
  const groupsBySeller = new Map();

  for (const line of lines) {
    const product = productMap.get(line.productId);

    if (!product) {
      throw new Error(
        `[seed] product ${line.productId} is missing`,
      );
    }

    const supplierId = getSupplierId(product);

    const sellerKey = supplierId
      ? `SUPPLIER:${supplierId}`
      : BORJAK_SELLER_KEY;

    let group = groupsBySeller.get(sellerKey);

    if (!group) {
      group = {
        sellerKey,
        supplierId,
        items: [],
      };

      groupsBySeller.set(sellerKey, group);
    }

    group.items.push(line);
  }

  return [...groupsBySeller.values()].sort(
    (a, b) => a.sellerKey.localeCompare(b.sellerKey),
  );
}

function getFulfillmentStatus(scenario) {
  if (scenario.delivered) return "DELIVERED";
  if (scenario.shipped) return "SHIPPED";

  if (scenario.key === "READY_TO_SHIP") {
    return "READY_FOR_HANDOVER";
  }

  return "PREPARING";
}

function buildFulfillmentPlan({
  groups,
  scenario,
  createdAt,
  readyAt,
  shippedAt,
  deliveredAt,
  rng,
}) {
  const status = getFulfillmentStatus(scenario);

  return groups.map((group) => {
    const handedOverAt = scenario.shipped
      ? minDate(
        addMs(
          shippedAt,
          -rng.int(1, 5) * MS.hour,
        ),
        shippedAt,
      )
      : null;

    const trackingCode = scenario.shipped
      ? trackingCodeFor(rng)
      : null;

    const fulfillmentUpdatedAt =
      deliveredAt ??
      shippedAt ??
      readyAt ??
      createdAt;

    return {
      ...group,

      status,
      shippingMethod: rng.pick(SHIPPING_METHODS),
      shippingCost: SHIPPING_COST_PER_FULFILLMENT,

      handedOverAt,
      trackingCode,
      trackingCodeAddedAt: handedOverAt,
      shippedAt: scenario.shipped ? shippedAt : null,
      deliveredAt: scenario.delivered ? deliveredAt : null,

      createdAt,
      updatedAt: fulfillmentUpdatedAt,
    };
  });
}

function getTotalShippingCost(groups) {
  const total = groups.reduce(
    (sum, group) => sum + group.shippingCost,
    0,
  );

  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("[seed] invalid fulfillment shipping total");
  }

  return assertInt32(total, "Order shipping cost");
}

function getLegacyShippingMethod(groups) {
  return groups.length === 1
    ? groups[0].shippingMethod
    : null;
}

export async function seedOrders({ prisma, rng, now }, { users, products }) {
  console.log("🛒 Seeding orders...");

  const buyers = users.customers.filter(
    (user) => user.isActive && user.isPhoneVerified,
  );

  const staff = [...users.admins];

  if (!buyers.length) {
    throw new Error("[seed] no eligible customers");
  }

  if (!staff.length) {
    throw new Error("[seed] no admin users available");
  }

  const productMap = new Map(
    products.map((product) => [product.id, product]),
  );

  const bySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  const archivedProduct = products.find(
    (product) => product.deletedAt && product.isPublished,
  );

  const lowStockProduct = bySlug.get(
    "lenovo-ideapad-slim-5-14",
  );

  if (!archivedProduct || !lowStockProduct) {
    throw new Error(
      "[seed] required scenario products are missing",
    );
  }

  // Oldest first, so IDs grow with time like a real database.
  const plan = [];

  for (const scenario of SCENARIOS) {
    for (let i = 0; i < scenario.count; i += 1) {
      plan.push({
        scenario,
        ageMinutes: rng.int(
          scenario.age[0],
          scenario.age[1],
        ),
      });
    }
  }

  plan.sort(
    (a, b) => b.ageMinutes - a.ageMinutes,
  );

  const reservedSoFar = new Map();
  const created = [];
  const seenScenario = new Map();

  let sequence = 0;

  for (const { scenario, ageMinutes } of plan) {
    sequence += 1;

    const nth =
      (seenScenario.get(scenario.key) || 0) + 1;

    seenScenario.set(scenario.key, nth);

    let forced = null;

    if (scenario.key === "DELIVERED" && nth === 1) {
      forced = archivedProduct;
    }

    if (
      scenario.key === "AWAITING_PAYMENT" &&
      nth === 1
    ) {
      forced = lowStockProduct;
    }

    const pick = (...slugs) =>
      slugs.map((slug) => {
        const product = bySlug.get(slug);

        if (!product) {
          throw new Error(
            `[seed] scenario product not found: ${slug}`,
          );
        }

        return product;
      });

    // Multi-supplier historical delivered order.
    if (
      scenario.key === "DELIVERED" &&
      nth === 2
    ) {
      forced = pick(
        "samsung-galaxy-s24-256gb",
        "sony-wh-1000xm5",
        "sony-alpha-a6400-16-50mm",
      );
    }

    // Multi-supplier shipped order including Borjak-owned goods.
    if (
      scenario.key === "SHIPPED" &&
      nth === 1
    ) {
      forced = pick(
        "nike-dri-fit-legend-t-shirt",
        "apple-macbook-air-m2-13",
        "jbl-tune-520bt",
      );
    }

    if (
      scenario.key === "PROCESSING" &&
      nth === 1
    ) {
      forced = pick(
        "samsung-galaxy-buds-fe",
        "lenovo-ideapad-slim-3-15",
      );
    }

    const customer = rng.pick(buyers);
    const address = customer.address;

    if (!address) {
      throw new Error(
        `[seed] customer ${customer.id} has no address`,
      );
    }

    const { lines, total: productSubtotal } = buildItems({
      rng,
      products,
      scenario,
      reservedSoFar,
      forced,
    });

    // Every order line must be represented by exactly one seller fulfillment.
    const sellerGroups = buildFulfillmentGroups(
      lines,
      productMap,
    );

    const createdAt = new Date(
      now.getTime() - ageMinutes * MS.minute,
    );

    const paid = scenario.payment === "PAID";

    const paidAt = paid
      ? minDate(
        addMs(
          createdAt,
          rng.int(3, 12) * MS.minute,
        ),
        now,
      )
      : null;

    const shippedAt = scenario.shipped
      ? minDate(
        addMs(
          paidAt,
          rng.int(4, 30) * MS.hour,
        ),
        now,
      )
      : null;

    const deliveredAt = scenario.delivered
      ? minDate(
        addMs(
          shippedAt,
          rng.int(1, 4) * MS.day,
        ),
        now,
      )
      : null;

    const readyAt =
      scenario.key === "READY_TO_SHIP"
        ? minDate(
          addMs(
            paidAt,
            rng.int(30, 180) * MS.minute,
          ),
          now,
        )
        : null;

    const lastEvent =
      [
        createdAt,
        paidAt,
        readyAt,
        shippedAt,
        deliveredAt,
      ]
        .filter(Boolean)
        .pop();

    const updatedAt =
      scenario.restocked || scenario.stockIssue
        ? minDate(
          addMs(
            lastEvent,
            rng.int(2, 24) * MS.hour,
          ),
          now,
        )
        : lastEvent;

    const hasAuthority =
      Boolean(scenario.tx) && !scenario.noAuthority;

    const authority = hasAuthority
      ? authorityFor(sequence)
      : null;

    const refId = paid
      ? String(10_000_000_000 + sequence * 7919)
      : null;

    let paymentExpiresAt = null;

    if (scenario.expiresInMinutes) {
      paymentExpiresAt = addMs(
        now,
        rng.int(...scenario.expiresInMinutes) * MS.minute,
      );
    } else if (scenario.expiredMinutesAgo) {
      paymentExpiresAt = addMs(
        now,
        -rng.int(...scenario.expiredMinutesAgo) * MS.minute,
      );
    }

    const fulfillmentPlan = buildFulfillmentPlan({
      groups: sellerGroups,
      scenario,
      createdAt,
      readyAt,
      shippedAt,
      deliveredAt,
      rng,
    });

    const shippingCost = getTotalShippingCost(
      fulfillmentPlan,
    );

    // Store coupon discounts are not implemented in this seed scenario yet.
    const couponDiscount = 0;

    // PAYER-compatible synthetic fee. Seed never calls the live ZarinPal API.
    const gatewayFee = 0;

    const total = assertInt32(
      productSubtotal +
      shippingCost -
      couponDiscount +
      gatewayFee,
      `${scenario.key} order total`,
    );

    if (total <= 0) {
      throw new Error(
        `[seed] invalid total for scenario ${scenario.key}`,
      );
    }

    // Two deterministic, multi-seller examples request printed invoices.
    const requiresPrintedInvoice =
      (
        scenario.key === "DELIVERED" &&
        nth === 2
      ) ||
      (
        scenario.key === "SHIPPED" &&
        nth === 1
      );

    const legacyShippingMethod =
      getLegacyShippingMethod(fulfillmentPlan);

    const legacyTrackingCode =
      fulfillmentPlan.length === 1
        ? fulfillmentPlan[0].trackingCode
        : null;

    const orderResult = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: customer.id,

            total,
            status: scenario.status,
            paymentStatus: scenario.payment,
            stockReservationStatus: scenario.stock,

            requiresPrintedInvoice,

            stockIssueAt: scenario.stockIssue
              ? updatedAt
              : null,

            stockRestockedAt: scenario.restocked
              ? updatedAt
              : null,

            authority,
            paymentExpiresAt,
            refId,
            paidAt,

            receiverName: address.receiverName,
            receiverPhone: address.receiverPhone,
            provinceId: address.provinceId,
            provinceName: address.provinceName,
            cityId: address.cityId,
            cityName: address.cityName,
            address: address.address,
            postalCode: address.postalCode,

            // Legacy fields are populated only when one seller exists.
            shippingMethod: legacyShippingMethod,
            shippingCost,
            couponDiscount,
            gatewayFee,

            trackingCode: legacyTrackingCode,
            shippedAt,
            deliveredAt,

            createdAt,
            updatedAt,
          },
        });

        const createdOrderItems = [];

        for (const line of lines) {
          const product = productMap.get(line.productId);

          if (!product) {
            throw new Error(
              `[seed] missing product ${line.productId}`,
            );
          }

          const financial =
            getProductFinancialSnapshot(product);

          if (financial.price !== line.price) {
            throw new Error(
              `[seed] order item price mismatch for product ${line.productId}`,
            );
          }

          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: line.productId,
              quantity: line.quantity,

              price: financial.price,

              supplierId: financial.supplierId,
              supplierSnapshotCaptured: true,

              basePriceAtPurchase:
                financial.basePriceAtPurchase,

              commissionPercentAtPurchase:
                financial.commissionPercentAtPurchase,

              originalPriceAtPurchase:
                financial.originalPriceAtPurchase,

              supplierDiscountPercentAtPurchase:
                financial.supplierDiscountPercentAtPurchase,

              supplierDiscountAmountAtPurchase:
                financial.supplierDiscountAmountAtPurchase,

              supplierPayoutAtPurchase:
                financial.supplierPayoutAtPurchase,

              commissionAmountAtPurchase:
                financial.commissionAmountAtPurchase,
            },
          });

          createdOrderItems.push(orderItem);
        }

        const orderItemByProductId = new Map(
          createdOrderItems.map((item) => [
            item.productId,
            item,
          ]),
        );

        const createdFulfillments = [];

        for (const group of fulfillmentPlan) {
          const fulfillment = await tx.orderFulfillment.create({
            data: {
              orderId: order.id,
              supplierId: group.supplierId,
              sellerKey: group.sellerKey,

              status: group.status,
              shippingMethod: group.shippingMethod,
              shippingCost: group.shippingCost,

              handedOverAt: group.handedOverAt,
              trackingCode: group.trackingCode,
              trackingCodeAddedAt:
                group.trackingCodeAddedAt,

              shippedAt: group.shippedAt,
              deliveredAt: group.deliveredAt,

              createdAt: group.createdAt,
              updatedAt: group.updatedAt,

              items: {
                create: group.items.map((line) => {
                  const orderItem =
                    orderItemByProductId.get(line.productId);

                  if (!orderItem) {
                    throw new Error(
                      `[seed] fulfillment is missing order item for product ${line.productId}`,
                    );
                  }

                  return {
                    orderItemId: orderItem.id,
                    quantity: orderItem.quantity,
                  };
                }),
              },
            },
          });

          createdFulfillments.push(fulfillment);
        }

        if (scenario.tx) {
          if (!authority) {
            throw new Error(
              `[seed] transaction has no authority for ${scenario.key}`,
            );
          }

          await tx.transaction.create({
            data: {
              orderId: order.id,
              authority,
              amount: total,
              status: scenario.tx,
              refId:
                scenario.tx === "SUCCESS"
                  ? refId
                  : null,
              createdAt,
              updatedAt: paidAt ?? createdAt,
            },
          });
        }

        if (scenario.attempt) {
          if (!authority) {
            throw new Error(
              `[seed] payment attempt has no authority for ${scenario.key}`,
            );
          }

          await tx.paymentAttempt.create({
            data: {
              orderId: order.id,
              userId: customer.id,
              authority,
              amount: total,
              status: scenario.attempt,
              refId:
                scenario.attempt === "PAID"
                  ? refId
                  : null,
              note: scenario.note ?? null,
              createdAt,
              updatedAt: paidAt ?? createdAt,
            },
          });
        }

        return {
          order,
          items: createdOrderItems,
          fulfillments: createdFulfillments,
        };
      },
    );

    // RESERVED orders increase only the reservedStock counter.
    // CONSUMED / RELEASED / ISSUE orders do not modify Product.stock here.
    if (scenario.stock === "RESERVED") {
      for (const line of lines) {
        reservedSoFar.set(
          line.productId,
          (reservedSoFar.get(line.productId) || 0) +
          line.quantity,
        );
      }
    }

    created.push({
      ...orderResult.order,
      items: orderResult.items,
      fulfillments: orderResult.fulfillments,
      scenario: scenario.key,
      staffActorId: rng.pick(staff).id,
    });
  }

  // Apply reservations in one UPDATE per product.
  for (const [productId, reserved] of reservedSoFar) {
    await prisma.product.update({
      where: { id: productId },
      data: { reservedStock: reserved },
    });
  }

  const summary = {};

  for (const order of created) {
    summary[order.scenario] =
      (summary[order.scenario] || 0) + 1;
  }

  const invoiceOrders = created.filter(
    (order) =>
      order.requiresPrintedInvoice &&
      order.paymentStatus === "PAID" &&
      order.status !== "CANCELLED",
  );

  console.log(
    `✅ ${created.length} orders seeded`,
    summary,
  );

  console.log(
    `🧾 ${invoiceOrders.length} paid orders seeded with printed invoice requests`,
  );

  return created;
}
