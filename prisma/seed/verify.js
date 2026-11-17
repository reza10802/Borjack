// Post-seed self-check. If any invariant of the stock/payment system is broken the
// seed fails here with a clear message, instead of producing data that makes
// the app (or your tests) misbehave later.

export async function verifySeed(prisma) {
  const problems = [];

  const reservation = await prisma.$queryRaw`
    SELECT p."id"::int AS id, p."reservedStock"::int AS stored, COALESCE(r.qty, 0)::int AS expected
    FROM "Product" p
    LEFT JOIN (
      SELECT oi."productId", SUM(oi."quantity") AS qty
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."stockReservationStatus" = 'RESERVED'
      GROUP BY oi."productId"
    ) r ON r."productId" = p."id"
    WHERE p."reservedStock" <> COALESCE(r.qty, 0)
  `;
  for (const row of reservation) {
    problems.push(`Product ${row.id}: reservedStock=${row.stored} but RESERVED orders hold ${row.expected}`);
  }

  const totals = await prisma.$queryRaw`
    SELECT o."id"::int AS id, o."total"::bigint::text AS total, i.sum::text AS items_sum
    FROM "Order" o
    JOIN (SELECT "orderId", SUM("price"::bigint * "quantity") AS sum FROM "OrderItem" GROUP BY "orderId") i
      ON i."orderId" = o."id"
    WHERE o."total"::bigint <> i.sum
  `;
  for (const row of totals) {
    problems.push(`Order ${row.id}: total=${row.total} but items sum to ${row.items_sum}`);
  }

  const noItems = await prisma.$queryRaw`
    SELECT o."id"::int AS id FROM "Order" o
    WHERE NOT EXISTS (SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = o."id")
  `;
  for (const row of noItems) problems.push(`Order ${row.id} has no items`);

  const txMismatch = await prisma.$queryRaw`
    SELECT o."id"::int AS id FROM "Order" o JOIN "Transaction" t ON t."orderId" = o."id"
    WHERE t."amount" <> o."total" OR t."authority" IS DISTINCT FROM o."authority"
  `;
  for (const row of txMismatch) problems.push(`Order ${row.id}: Transaction amount/authority differs from the order`);

  const paidWithoutRef = await prisma.$queryRaw`
    SELECT "id"::int AS id FROM "Order" WHERE "paymentStatus" = 'PAID' AND ("refId" IS NULL OR "paidAt" IS NULL)
  `;
  for (const row of paidWithoutRef) problems.push(`Order ${row.id} is PAID without refId/paidAt`);

  // ── Marketplace invariants (SUPPLIER model) ──────────────────────────────────────────
  const roleRows = await prisma.$queryRaw`SELECT role::text AS role, COUNT(*)::int AS n FROM "User" GROUP BY 1`;
  const roles = Object.fromEntries(roleRows.map((r) => [r.role, r.n]));
  for (const role of Object.keys(roles)) {
    if (!['ADMIN', 'SUPPLIER', 'CUSTOMER'].includes(role)) problems.push(`${roles[role]} user(s) have the unexpected role ${role}`);
  }
  if (roles.ADMIN !== 1) problems.push(`expected exactly 1 ADMIN, found ${roles.ADMIN ?? 0}`);
  if (roles.SUPPLIER !== 4) problems.push(`expected exactly 4 SUPPLIER users, found ${roles.SUPPLIER ?? 0}`);
  if (!roles.CUSTOMER) problems.push("no CUSTOMER users were seeded");

  const badOwners = await prisma.$queryRaw`
    SELECT p."id"::int AS id FROM "Product" p JOIN "User" u ON u."id" = p."supplierId"
    WHERE u.role::text <> 'SUPPLIER'
  `;
  for (const row of badOwners) problems.push(`Product ${row.id} is owned by a user that is not a SUPPLIER`);

  const idleSuppliers = await prisma.$queryRaw`
    SELECT u."phone" FROM "User" u
    WHERE u.role::text = 'SUPPLIER' AND NOT EXISTS (
      SELECT 1 FROM "Product" p
      WHERE p."supplierId" = u."id" AND p."isPublished" = TRUE AND p."deletedAt" IS NULL)
  `;
  for (const row of idleSuppliers) problems.push(`supplier ${row.phone} owns no published, non-archived product`);

  const [scen] = await prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "supplierId" IS NULL)::int AS borjak_owned,
      COUNT(*) FILTER (WHERE "stock" = 0 AND "isPublished" AND "deletedAt" IS NULL)::int AS out_of_stock,
      COUNT(*) FILTER (WHERE "stock" = 1 AND "isPublished" AND "deletedAt" IS NULL)::int AS one_left,
      COUNT(*) FILTER (WHERE NOT "isPublished")::int AS unpublished,
      COUNT(*) FILTER (WHERE "deletedAt" IS NOT NULL)::int AS archived
    FROM "Product"
  `;
  for (const [key, label] of [
    ["borjak_owned", "a Borjak-owned (supplierId NULL) product"],
    ["out_of_stock", "an out-of-stock product"],
    ["one_left", "a one-unit-left product"],
    ["unpublished", "an unpublished product"],
    ["archived", "an archived product"],
  ]) {
    if (!scen[key]) problems.push(`missing scenario: ${label}`);
  }

  const multi = await prisma.$queryRaw`
    SELECT oi."orderId"::int AS id FROM "OrderItem" oi JOIN "Product" p ON p."id" = oi."productId"
    WHERE p."supplierId" IS NOT NULL
    GROUP BY oi."orderId" HAVING COUNT(DISTINCT p."supplierId") >= 2
  `;
  if (!multi.length) problems.push("no order contains products of two different suppliers");

  if (problems.length) {
    throw new Error(`Seed verification failed:\n  - ${problems.join("\n  - ")}`);
  }

  const [counts] = await prisma.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM "User")::int AS users,
      (SELECT COUNT(*) FROM "Product")::int AS products,
      (SELECT COUNT(*) FROM "Order")::int AS orders,
      (SELECT COUNT(*) FROM "Review")::int AS reviews,
      (SELECT COUNT(*) FROM "Product" WHERE "supplierId" IS NOT NULL)::int AS supplier_products
  `;
  console.log(
    `✅ Invariants OK (users=${counts.users}, products=${counts.products}, orders=${counts.orders}, reviews=${counts.reviews}, supplier-owned products=${counts.supplier_products}, multi-supplier orders=${multi.length})`,
  );
}
