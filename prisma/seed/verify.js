
// Post-seed self-check.
// Validates stock, financial snapshots, payments and seller fulfillments.

const SHIPPING_COST_PER_FULFILLMENT = 200_000;
const SHIPPING_METHODS = ["POST", "POST_EXPRESS"];

export async function verifySeed(prisma) {
  const problems = [];

  // ── Stock reservation integrity ──────────────────────────────

  const reservation = await prisma.$queryRaw`
    SELECT
      p."id"::int AS id,
      p."reservedStock"::int AS stored,
      COALESCE(r.qty, 0)::int AS expected
    FROM "Product" p
    LEFT JOIN (
      SELECT
        oi."productId",
        SUM(oi."quantity") AS qty
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."stockReservationStatus" = 'RESERVED'
      GROUP BY oi."productId"
    ) r ON r."productId" = p."id"
    WHERE p."reservedStock" <> COALESCE(r.qty, 0)
  `;

  for (const row of reservation) {
    problems.push(
      `Product ${row.id}: reservedStock=${row.stored} but RESERVED orders hold ${row.expected}`,
    );
  }

  // ── Order item existence ──────────────────────────────────────

  const noItems = await prisma.$queryRaw`
    SELECT o."id"::int AS id
    FROM "Order" o
    WHERE NOT EXISTS (
      SELECT 1
      FROM "OrderItem" oi
      WHERE oi."orderId" = o."id"
    )
  `;

  for (const row of noItems) {
    problems.push(`Order ${row.id} has no items`);
  }

  // ── Financial snapshot integrity ─────────────────────────────

  const incompleteSnapshots = await prisma.$queryRaw`
    SELECT oi."id"::int AS id
    FROM "OrderItem" oi
    WHERE
      oi."supplierSnapshotCaptured" IS NOT TRUE
      OR (
        oi."supplierId" IS NOT NULL
        AND (
          oi."basePriceAtPurchase" IS NULL
          OR oi."commissionPercentAtPurchase" IS NULL
          OR oi."originalPriceAtPurchase" IS NULL
          OR oi."supplierDiscountPercentAtPurchase" IS NULL
          OR oi."supplierDiscountAmountAtPurchase" IS NULL
          OR oi."supplierPayoutAtPurchase" IS NULL
          OR oi."commissionAmountAtPurchase" IS NULL

          OR oi."basePriceAtPurchase" <= 0
          OR oi."commissionPercentAtPurchase" NOT BETWEEN 10 AND 15
          OR oi."originalPriceAtPurchase" <= 0
          OR oi."supplierDiscountPercentAtPurchase" NOT BETWEEN 0 AND 99
          OR oi."supplierDiscountAmountAtPurchase" < 0
          OR oi."supplierPayoutAtPurchase" <= 0
          OR oi."commissionAmountAtPurchase" < 0

          OR (
            oi."basePriceAtPurchase"::bigint
            - oi."supplierDiscountAmountAtPurchase"::bigint
          ) <> oi."supplierPayoutAtPurchase"::bigint

          OR (
            oi."supplierPayoutAtPurchase"::bigint
            + oi."commissionAmountAtPurchase"::bigint
          ) <> oi."price"::bigint
        )
      )
  `;

  for (const row of incompleteSnapshots) {
    problems.push(
      `OrderItem ${row.id} has an incomplete or inconsistent financial snapshot`,
    );
  }

  // ── Order financial breakdown ────────────────────────────────

  const totals = await prisma.$queryRaw`
    WITH item_totals AS (
      SELECT
        "orderId",
        SUM("price"::bigint * "quantity"::bigint) AS subtotal
      FROM "OrderItem"
      GROUP BY "orderId"
    )
    SELECT
      o."id"::int AS id,
      o."total"::bigint::text AS total,
      COALESCE(i.subtotal, 0)::text AS items_sum,
      o."shippingCost"::bigint::text AS shipping_cost,
      o."couponDiscount"::bigint::text AS coupon_discount,
      o."gatewayFee"::bigint::text AS gateway_fee
    FROM "Order" o
    LEFT JOIN item_totals i ON i."orderId" = o."id"
    WHERE
      o."total"::bigint <>
        COALESCE(i.subtotal, 0)
        + o."shippingCost"::bigint
        - o."couponDiscount"::bigint
        + o."gatewayFee"::bigint
      OR o."couponDiscount" < 0
      OR o."gatewayFee" < 0
      OR o."shippingCost" < 0
      OR o."couponDiscount"::bigint > COALESCE(i.subtotal, 0)
  `;

  for (const row of totals) {
    problems.push(
      `Order ${row.id}: financial breakdown mismatch (total=${row.total}, items=${row.items_sum}, shipping=${row.shipping_cost}, discount=${row.coupon_discount}, gatewayFee=${row.gateway_fee})`,
    );
  }

  // ── Fulfillment existence ─────────────────────────────────────

  const noFulfillments = await prisma.$queryRaw`
    SELECT o."id"::int AS id
    FROM "Order" o
    WHERE NOT EXISTS (
      SELECT 1
      FROM "OrderFulfillment" f
      WHERE f."orderId" = o."id"
    )
  `;

  for (const row of noFulfillments) {
    problems.push(
      `Order ${row.id} has no fulfillment`,
    );
  }

  // ── Fulfillment seller groups ─────────────────────────────────

  const badFulfillmentGroups = await prisma.$queryRaw`
    WITH expected_groups AS (
      SELECT
        oi."orderId",
        CASE
          WHEN oi."supplierId" IS NULL THEN 'BORJAK'
          ELSE 'SUPPLIER:' || oi."supplierId"
        END AS seller_key,
        oi."supplierId",
        COUNT(*)::int AS item_count
      FROM "OrderItem" oi
      GROUP BY
        oi."orderId",
        oi."supplierId"
    ),
    actual_groups AS (
      SELECT
        f."orderId",
        f."sellerKey" AS seller_key,
        f."supplierId",
        COUNT(fi."id")::int AS item_count
      FROM "OrderFulfillment" f
      LEFT JOIN "FulfillmentItem" fi
        ON fi."fulfillmentId" = f."id"
      GROUP BY
        f."orderId",
        f."sellerKey",
        f."supplierId"
    )
    SELECT
      COALESCE(e."orderId", a."orderId")::int AS id,
      COALESCE(e.seller_key, a.seller_key) AS seller_key
    FROM expected_groups e
    FULL OUTER JOIN actual_groups a
      ON e."orderId" = a."orderId"
      AND e.seller_key = a.seller_key
    WHERE
      e."orderId" IS NULL
      OR a."orderId" IS NULL
      OR e."supplierId" IS DISTINCT FROM a."supplierId"
      OR e.item_count <> a.item_count
  `;

  for (const row of badFulfillmentGroups) {
    problems.push(
      `Order ${row.id}: fulfillment seller group mismatch (${row.seller_key})`,
    );
  }

  // ── Every order item must belong to one fulfillment ───────────

  const missingFulfillmentItems = await prisma.$queryRaw`
    SELECT
      oi."id"::int AS item_id,
      oi."orderId"::int AS order_id
    FROM "OrderItem" oi
    WHERE NOT EXISTS (
      SELECT 1
      FROM "FulfillmentItem" fi
      WHERE fi."orderItemId" = oi."id"
    )
  `;

  for (const row of missingFulfillmentItems) {
    problems.push(
      `OrderItem ${row.item_id} from Order ${row.order_id} is not assigned to a fulfillment`,
    );
  }

  // ── Fulfillment item ownership and quantity ──────────────────

  const badFulfillmentMappings = await prisma.$queryRaw`
    SELECT
      fi."id"::int AS id,
      oi."id"::int AS order_item_id,
      f."orderId"::int AS fulfillment_order_id,
      oi."orderId"::int AS item_order_id
    FROM "FulfillmentItem" fi
    JOIN "OrderFulfillment" f
      ON f."id" = fi."fulfillmentId"
    JOIN "OrderItem" oi
      ON oi."id" = fi."orderItemId"
    WHERE
      fi."quantity" <> oi."quantity"
      OR f."orderId" <> oi."orderId"
      OR f."supplierId" IS DISTINCT FROM oi."supplierId"
      OR f."sellerKey" <> CASE
        WHEN oi."supplierId" IS NULL THEN 'BORJAK'
        ELSE 'SUPPLIER:' || oi."supplierId"
      END
  `;

  for (const row of badFulfillmentMappings) {
    problems.push(
      `FulfillmentItem ${row.id} has an invalid order/seller/quantity mapping (OrderItem ${row.order_item_id})`,
    );
  }

  // ── Fulfillment shipping rules ────────────────────────────────

  const invalidShipping = await prisma.$queryRaw`
    SELECT
      f."id" AS id,
      f."orderId"::int AS order_id,
      f."shippingMethod"::text AS method,
      f."shippingCost"::int AS cost
    FROM "OrderFulfillment" f
    WHERE
      f."shippingMethod" IS NULL
      OR f."shippingMethod"::text NOT IN ('POST', 'POST_EXPRESS')
      OR f."shippingCost" <> ${SHIPPING_COST_PER_FULFILLMENT}
  `;

  for (const row of invalidShipping) {
    problems.push(
      `Fulfillment ${row.id} of Order ${row.order_id} has invalid shipping (method=${row.method}, cost=${row.cost})`,
    );
  }

  // ── Order shipping total must equal its fulfillments ──────────

  const shippingMismatches = await prisma.$queryRaw`
    SELECT
      o."id"::int AS id,
      o."shippingCost"::int AS stored,
      COALESCE(SUM(f."shippingCost"), 0)::int AS expected
    FROM "Order" o
    LEFT JOIN "OrderFulfillment" f
      ON f."orderId" = o."id"
    GROUP BY o."id"
    HAVING
      o."shippingCost"::bigint <>
      COALESCE(SUM(f."shippingCost"), 0)::bigint
  `;

  for (const row of shippingMismatches) {
    problems.push(
      `Order ${row.id}: shippingCost=${row.stored} but fulfillments total ${row.expected}`,
    );
  }

  // ── Legacy shipping method consistency ────────────────────────

  const legacyShippingMismatches = await prisma.$queryRaw`
    WITH fulfillment_counts AS (
      SELECT
        "orderId",
        COUNT(*)::int AS item_count,
        MIN("shippingMethod"::text) AS sole_method
      FROM "OrderFulfillment"
      GROUP BY "orderId"
    )
    SELECT o."id"::int AS id
    FROM "Order" o
    JOIN fulfillment_counts f
      ON f."orderId" = o."id"
    WHERE
      (
        f.item_count = 1
        AND o."shippingMethod"::text IS DISTINCT FROM f.sole_method
      )
      OR (
        f.item_count > 1
        AND o."shippingMethod" IS NOT NULL
      )
  `;

  for (const row of legacyShippingMismatches) {
    problems.push(
      `Order ${row.id}: legacy shippingMethod does not match its fulfillment plan`,
    );
  }

  // ── Transaction integrity ──────────────────────────────────────

  const txMismatch = await prisma.$queryRaw`
    SELECT o."id"::int AS id
    FROM "Order" o
    JOIN "Transaction" t
      ON t."orderId" = o."id"
    WHERE
      t."amount" <> o."total"
      OR t."authority" IS DISTINCT FROM o."authority"
      OR (
        t."status" = 'SUCCESS'
        AND t."refId" IS DISTINCT FROM o."refId"
      )
  `;

  for (const row of txMismatch) {
    problems.push(
      `Order ${row.id}: Transaction amount/authority/reference differs from the order`,
    );
  }

  const paidWithoutRef = await prisma.$queryRaw`
    SELECT "id"::int AS id
    FROM "Order"
    WHERE
      "paymentStatus" = 'PAID'
      AND ("refId" IS NULL OR "paidAt" IS NULL)
  `;

  for (const row of paidWithoutRef) {
    problems.push(
      `Order ${row.id} is PAID without refId/paidAt`,
    );
  }

  const paidWithoutSuccessfulTransaction =
    await prisma.$queryRaw`
      SELECT o."id"::int AS id
      FROM "Order" o
      LEFT JOIN "Transaction" t
        ON t."orderId" = o."id"
      WHERE
        o."paymentStatus" = 'PAID'
        AND (
          t."id" IS NULL
          OR t."status" <> 'SUCCESS'
          OR t."amount" <> o."total"
        )
    `;

  for (const row of paidWithoutSuccessfulTransaction) {
    problems.push(
      `Order ${row.id} is PAID without a successful matching Transaction`,
    );
  }

  // ── Marketplace invariants ────────────────────────────────────

  const roleRows = await prisma.$queryRaw`
    SELECT
      role::text AS role,
      COUNT(*)::int AS n
    FROM "User"
    GROUP BY 1
  `;

  const roles = Object.fromEntries(
    roleRows.map((row) => [row.role, row.n]),
  );

  for (const role of Object.keys(roles)) {
    if (!["ADMIN", "SUPPLIER", "CUSTOMER"].includes(role)) {
      problems.push(
        `${roles[role]} user(s) have the unexpected role ${role}`,
      );
    }
  }

  if (roles.ADMIN !== 1) {
    problems.push(
      `expected exactly 1 ADMIN, found ${roles.ADMIN ?? 0}`,
    );
  }

  if (roles.SUPPLIER !== 4) {
    problems.push(
      `expected exactly 4 SUPPLIER users, found ${roles.SUPPLIER ?? 0}`,
    );
  }

  if (!roles.CUSTOMER) {
    problems.push("no CUSTOMER users were seeded");
  }

  const badOwners = await prisma.$queryRaw`
    SELECT p."id"::int AS id
    FROM "Product" p
    JOIN "User" u
      ON u."id" = p."supplierId"
    WHERE u.role::text <> 'SUPPLIER'
  `;

  for (const row of badOwners) {
    problems.push(
      `Product ${row.id} is owned by a user that is not a SUPPLIER`,
    );
  }

  const idleSuppliers = await prisma.$queryRaw`
    SELECT u."phone"
    FROM "User" u
    WHERE
      u.role::text = 'SUPPLIER'
      AND NOT EXISTS (
        SELECT 1
        FROM "Product" p
        WHERE
          p."supplierId" = u."id"
          AND p."isPublished" = TRUE
          AND p."deletedAt" IS NULL
      )
  `;

  for (const row of idleSuppliers) {
    problems.push(
      `supplier ${row.phone} owns no published, non-archived product`,
    );
  }

  const [scen] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (
        WHERE "supplierId" IS NULL
      )::int AS borjak_owned,

      COUNT(*) FILTER (
        WHERE
          "stock" = 0
          AND "isPublished"
          AND "deletedAt" IS NULL
      )::int AS out_of_stock,

      COUNT(*) FILTER (
        WHERE
          "stock" = 1
          AND "isPublished"
          AND "deletedAt" IS NULL
      )::int AS one_left,

      COUNT(*) FILTER (
        WHERE NOT "isPublished"
      )::int AS unpublished,

      COUNT(*) FILTER (
        WHERE "deletedAt" IS NOT NULL
      )::int AS archived

    FROM "Product"
  `;

  for (const [key, label] of [
    ["borjak_owned", "a Borjak-owned (supplierId NULL) product"],
    ["out_of_stock", "an out-of-stock product"],
    ["one_left", "a one-unit-left product"],
    ["unpublished", "an unpublished product"],
    ["archived", "an archived product"],
  ]) {
    if (!scen[key]) {
      problems.push(`missing scenario: ${label}`);
    }
  }

  const multi = await prisma.$queryRaw`
    SELECT oi."orderId"::int AS id
    FROM "OrderItem" oi
    JOIN "Product" p
      ON p."id" = oi."productId"
    WHERE p."supplierId" IS NOT NULL
    GROUP BY oi."orderId"
    HAVING COUNT(DISTINCT p."supplierId") >= 2
  `;

  if (!multi.length) {
    problems.push(
      "no order contains products of two different suppliers",
    );
  }

  // ── Printed invoice test data ─────────────────────────────────

  const [invoiceScenarios] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "Order" o
    WHERE
      o."requiresPrintedInvoice" = TRUE
      AND o."paymentStatus" = 'PAID'
      AND o."status" <> 'CANCELLED'
      AND (
        SELECT COUNT(*)
        FROM "OrderFulfillment" f
        WHERE f."orderId" = o."id"
      ) >= 2
  `;

  if (invoiceScenarios.count < 2) {
    problems.push(
      `expected at least 2 paid multi-fulfillment orders with printed invoice requests, found ${invoiceScenarios.count}`,
    );
  }

  // ── Final result ──────────────────────────────────────────────

  if (problems.length) {
    throw new Error(
      `Seed verification failed:\n  - ${problems.join("\n  - ")}`,
    );
  }

  const [counts] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM "User")::int AS users,
      (SELECT COUNT(*) FROM "Product")::int AS products,
      (SELECT COUNT(*) FROM "Order")::int AS orders,
      (SELECT COUNT(*) FROM "Review")::int AS reviews,

      (
        SELECT COUNT(*)
        FROM "Product"
        WHERE "supplierId" IS NOT NULL
      )::int AS supplier_products,

      (
        SELECT COUNT(*)
        FROM "OrderFulfillment"
      )::int AS fulfillments,

      (
        SELECT COUNT(*)
        FROM "Order"
        WHERE
          "requiresPrintedInvoice" = TRUE
          AND "paymentStatus" = 'PAID'
          AND "status" <> 'CANCELLED'
      )::int AS invoice_orders
  `;

  console.log(
    `✅ Invariants OK (users=${counts.users}, products=${counts.products}, orders=${counts.orders}, reviews=${counts.reviews}, supplier products=${counts.supplier_products}, fulfillments=${counts.fulfillments}, invoice orders=${counts.invoice_orders}, multi-supplier orders=${multi.length})`,
  );
}
