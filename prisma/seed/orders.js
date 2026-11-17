import { MS, addMs, minDate, assertInt32 } from "./_lib.js";

// ─────────────────────────────────────────────────────────────────────────────
// Orders are generated from named SCENARIOS that mirror what the real app writes
// (see src/app/api/order, src/lib/payment-settlement.js, payment-recon.js,
// stock-reservation.js). Status / paymentStatus / stockReservationStatus /
// Transaction / PaymentAttempt are always a combination the app can really produce,
// instead of the old independent random mix (e.g. DELIVERED + payment FAILED).
//
// Stock model:
//   - Product.stock in products.js is the CURRENT stock, i.e. it already reflects
//     sales of all CONSUMED orders. So CONSUMED/RELEASED/ISSUE orders don't touch it.
//   - RESERVED orders add to Product.reservedStock (checked against stock, so the DB
//     CHECK constraints always hold).
// ─────────────────────────────────────────────────────────────────────────────

const MAX_ORDER_TOTAL = 1_500_000_000; // far below the Int32 limit (old seed overflowed at 2.14B)
const BIG_TICKET = 50_000_000;
const DAY = 24 * 60; // minutes

const SCENARIOS = [
  {
    key: "DELIVERED", count: 24, age: [10 * DAY, 90 * DAY],
    status: "DELIVERED", payment: "PAID", stock: "CONSUMED", tx: "SUCCESS", attempt: "PAID",
    shipped: true, delivered: true, historical: true,
  },
  {
    key: "SHIPPED", count: 7, age: [3 * DAY, 9 * DAY],
    status: "SHIPPED", payment: "PAID", stock: "CONSUMED", tx: "SUCCESS", attempt: "PAID", shipped: true,
  },
  {
    key: "READY_TO_SHIP", count: 5, age: [1 * DAY, 3 * DAY],
    status: "READY_TO_SHIP", payment: "PAID", stock: "CONSUMED", tx: "SUCCESS", attempt: "PAID",
  },
  {
    key: "PROCESSING", count: 6, age: [60, 2 * DAY],
    status: "PROCESSING", payment: "PAID", stock: "CONSUMED", tx: "SUCCESS", attempt: "PAID",
  },
  {
    // Customer is at the gateway right now: reservation is live and not yet expired.
    key: "AWAITING_PAYMENT", count: 2, age: [3, 10],
    status: "PENDING", payment: "PENDING", stock: "RESERVED", tx: "PENDING", attempt: "PENDING",
    expiresInMinutes: [5, 12],
  },
  {
    // Reservation expired 40-60 min ago and was never settled: the cron job should pick it up.
    key: "EXPIRED_RESERVATION", count: 1, age: [100, 130],
    status: "PENDING", payment: "PENDING", stock: "RESERVED", tx: "PENDING", attempt: "PENDING",
    expiredMinutesAgo: [40, 60],
  },
  {
    // Same, but reconciliation could not decide -> PaymentAttempt REVIEW (manual check).
    key: "NEEDS_REVIEW", count: 1, age: [150, 200],
    status: "PENDING", payment: "PENDING", stock: "RESERVED", tx: "PENDING", attempt: "REVIEW",
    expiredMinutesAgo: [90, 120], note: "reconciliation inconclusive - manual review required",
  },
  {
    key: "NOT_STARTED", count: 2, age: [5, 90],
    status: "PENDING", payment: "PENDING", stock: "NONE",
  },
  {
    // order/[id] DELETE: soft-cancel by the customer.
    key: "USER_CANCELLED", count: 4, age: [2 * DAY, 40 * DAY],
    status: "CANCELLED", payment: "FAILED", stock: "NONE", noAuthority: true,
  },
  {
    // Reservation expired and was released by the reconciliation job.
    key: "PAYMENT_EXPIRED", count: 3, age: [1 * DAY, 30 * DAY],
    status: "PENDING", payment: "PENDING", stock: "RELEASED", tx: "FAILED", attempt: "EXPIRED",
    note: "expired; ZarinPal Inquiry status FAILED",
  },
  {
    // Paid, then cancelled by an admin: stock returned, money must be refunded
    // (shows up in /api/admin/payments/issues).
    key: "CANCELLED_AFTER_PAYMENT", count: 3, age: [5 * DAY, 50 * DAY],
    status: "CANCELLED", payment: "PAID", stock: "RELEASED", tx: "SUCCESS", attempt: "PAID",
    restocked: true, historical: true,
  },
  {
    // Paid but the stock was gone at settlement time (ISSUE): needs manual refund.
    key: "PAID_STOCK_ISSUE", count: 2, age: [1 * DAY, 20 * DAY],
    status: "CANCELLED", payment: "PAID", stock: "ISSUE", tx: "SUCCESS", attempt: "PAID",
    stockIssue: true, note: "paid; stock issue - manual refund/review required",
  },
];

const SHIPPING_METHODS = ["POST", "TIPAX", "SNAPPBOX"];

// Zarinpal authorities look like "A" + 35 digits.
const authorityFor = (n) => `A${String(n).padStart(35, "0")}`;

function digits(rng, n) {
  return Array.from({ length: n }, () => rng.int(0, 9)).join("");
}

function trackingCodeFor(rng, method) {
  if (method === "POST") return digits(rng, 20);
  if (method === "TIPAX") return `TP${digits(rng, 10)}`;
  return `SB${digits(rng, 9)}`;
}

function buildItems({ rng, products, scenario, reservedSoFar, forced }) {
  const reserving = scenario.stock === "RESERVED";

  let pool = products.filter(
    (p) => (p.isPublished && !p.deletedAt) || (scenario.historical && p.isPublished && p.deletedAt),
  );

  if (reserving) {
    pool = pool.filter((p) => !p.deletedAt && p.stock - (reservedSoFar.get(p.id) || 0) >= 1);
  }

  const wanted = Math.max(rng.weighted([[1, 45], [2, 30], [3, 15], [4, 10]]), forced ? [].concat(forced).length : 0);
  const lines = [];
  let total = 0;

  const forcedList = forced ? [].concat(forced) : [];
  const ordered = [...forcedList, ...rng.shuffle(pool.filter((p) => !forcedList.includes(p)))];

  for (const product of ordered) {
    if (lines.length >= wanted) break;

    let quantity = product.price >= BIG_TICKET ? (rng.chance(0.15) ? 2 : 1) : rng.int(1, 3);

    if (reserving) {
      quantity = Math.min(quantity, product.stock - (reservedSoFar.get(product.id) || 0));
      if (quantity < 1) continue;
    }

    // Old orders were sometimes bought at the pre-discount price: the order keeps ITS
    // price even though the product price changed later (snapshot behaviour).
    const drifted =
      scenario.historical && product.originalPrice > product.price && rng.chance(0.25);
    const unit = drifted ? product.originalPrice : product.price;

    if (total + unit * quantity > MAX_ORDER_TOTAL) continue;

    lines.push({ productId: product.id, quantity, price: unit });
    total += unit * quantity;
  }

  if (!lines.length) {
    throw new Error(`[seed] could not build items for scenario ${scenario.key}`);
  }

  return { lines, total: assertInt32(total, `${scenario.key} order total`) };
}

export async function seedOrders({ prisma, rng, now }, { users, products }) {
  console.log("🛒 Seeding orders...");

  // Only customers who can actually check out (active + verified phone).
  const buyers = users.customers.filter((u) => u.isActive && u.isPhoneVerified);
  // Only ADMIN moves orders through the fulfilment flow (suppliers have no order access in P1).
  const staff = [...users.admins];
  if (!buyers.length) throw new Error("[seed] no eligible customers");

  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const archivedProduct = products.find((p) => p.deletedAt && p.isPublished);
  const lowStockProduct = bySlug.get("lenovo-ideapad-slim-5-14");

  // Oldest first, so order ids grow with time like in a real database.
  const plan = [];
  for (const scenario of SCENARIOS) {
    for (let i = 0; i < scenario.count; i++) {
      plan.push({ scenario, ageMinutes: rng.int(scenario.age[0], scenario.age[1]) });
    }
  }
  plan.sort((a, b) => b.ageMinutes - a.ageMinutes);

  const reservedSoFar = new Map();
  const created = [];
  const seenScenario = new Map();
  let sequence = 0;

  for (const { scenario, ageMinutes } of plan) {
    sequence += 1;
    const nth = (seenScenario.get(scenario.key) || 0) + 1;
    seenScenario.set(scenario.key, nth);

    // Deterministic guarantees for the scenarios the products were designed for:
    //  - an archived product must have an old, completed order
    //  - the 1-unit product is held by a live reservation
    let forced = null;
    if (scenario.key === "DELIVERED" && nth === 1) forced = archivedProduct;
    if (scenario.key === "AWAITING_PAYMENT" && nth === 1) forced = lowStockProduct;

    // Multi-supplier orders (one order, several owners) for access-isolation tests:
    //  - DELIVERED #2: suppliers 1, 2 and 3          - SHIPPED #1: supplier 4, supplier 1 and Borjak-owned (NULL)
    //  - PROCESSING #1: suppliers 2 and 1
    const pick = (...slugs) => slugs.map((slug) => bySlug.get(slug));
    if (scenario.key === "DELIVERED" && nth === 2) forced = pick("samsung-galaxy-s24-256gb", "sony-wh-1000xm5", "sony-alpha-a6400-16-50mm");
    if (scenario.key === "SHIPPED" && nth === 1) forced = pick("nike-dri-fit-legend-t-shirt", "apple-macbook-air-m2-13", "jbl-tune-520bt");
    if (scenario.key === "PROCESSING" && nth === 1) forced = pick("samsung-galaxy-buds-fe", "lenovo-ideapad-slim-3-15");

    const customer = rng.pick(buyers);
    const address = customer.address;
    const method = rng.pick(SHIPPING_METHODS);

    const { lines, total } = buildItems({ rng, products, scenario, reservedSoFar, forced });

    const createdAt = new Date(now.getTime() - ageMinutes * MS.minute);
    const paid = scenario.payment === "PAID";
    const paidAt = paid ? minDate(addMs(createdAt, rng.int(3, 12) * MS.minute), now) : null;
    const shippedAt = scenario.shipped ? minDate(addMs(paidAt, rng.int(4, 30) * MS.hour), now) : null;
    const deliveredAt = scenario.delivered
      ? minDate(addMs(shippedAt, rng.int(1, 4) * MS.day), now)
      : null;

    const hasAuthority = Boolean(scenario.tx) && !scenario.noAuthority;
    const authority = hasAuthority ? authorityFor(sequence) : null;
    const refId = paid ? String(10_000_000_000 + sequence * 7919) : null;

    let paymentExpiresAt = null;
    if (scenario.expiresInMinutes) {
      paymentExpiresAt = addMs(now, rng.int(...scenario.expiresInMinutes) * MS.minute);
    } else if (scenario.expiredMinutesAgo) {
      paymentExpiresAt = addMs(now, -rng.int(...scenario.expiredMinutesAgo) * MS.minute);
    }

    const lastEvent = [createdAt, paidAt, shippedAt, deliveredAt].filter(Boolean).pop();
    const updatedAt = scenario.restocked || scenario.stockIssue
      ? minDate(addMs(lastEvent, rng.int(2, 24) * MS.hour), now)
      : lastEvent;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        total,
        status: scenario.status,
        paymentStatus: scenario.payment,
        stockReservationStatus: scenario.stock,
        stockIssueAt: scenario.stockIssue ? updatedAt : null,
        stockRestockedAt: scenario.restocked ? updatedAt : null,

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

        shippingMethod: method,
        shippingCost: 0, // the checkout flow currently always stores 0
        trackingCode: shippedAt ? trackingCodeFor(rng, method) : null,
        shippedAt,
        deliveredAt,

        createdAt,
        updatedAt,

        items: { create: lines },

        transaction: scenario.tx
          ? {
              create: {
                authority,
                amount: total,
                status: scenario.tx,
                refId: scenario.tx === "SUCCESS" ? refId : null,
                createdAt,
                updatedAt: paidAt ?? createdAt,
              },
            }
          : undefined,
      },
      include: { items: true },
    });

    if (scenario.attempt) {
      await prisma.paymentAttempt.create({
        data: {
          orderId: order.id,
          userId: customer.id,
          authority,
          amount: total,
          status: scenario.attempt,
          refId: scenario.attempt === "PAID" ? refId : null,
          note: scenario.note ?? null,
          createdAt,
          updatedAt: paidAt ?? createdAt,
        },
      });
    }

    if (scenario.stock === "RESERVED") {
      for (const line of lines) {
        reservedSoFar.set(line.productId, (reservedSoFar.get(line.productId) || 0) + line.quantity);
      }
    }

    created.push({ ...order, scenario: scenario.key, staffActorId: rng.pick(staff).id });
  }

  // Apply reservations in one UPDATE per product. The DB CHECK constraint
  // (reservedStock <= stock) holds because buildItems respected the capacity.
  for (const [productId, reserved] of reservedSoFar) {
    await prisma.product.update({ where: { id: productId }, data: { reservedStock: reserved } });
  }

  const summary = {};
  for (const o of created) summary[o.scenario] = (summary[o.scenario] || 0) + 1;
  console.log(`✅ ${created.length} orders seeded`, summary);

  return created;
}
