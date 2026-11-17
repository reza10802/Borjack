import "dotenv/config";

import { PrismaClient, Role } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { createRng } from "./seed/_lib.js";
import { seedUsers } from "./seed/users.js";
import { seedProducts } from "./seed/products.js";
import { seedShoppers } from "./seed/shoppers.js";
import { seedOrders } from "./seed/orders.js";
import { seedReviews } from "./seed/reviews.js";
import { seedTasks } from "./seed/tasks.js";
import { seedLogs } from "./seed/logs.js";
import { verifySeed } from "./seed/verify.js";
import { assertSafeSeedTarget, assertOnlySeedUsers, removedFlagWarnings, SeedRefusal } from "./seed/guards.js";

// ─────────────────────────────────────────────────────────────
// Safety: this script WIPES every table (except _prisma_migrations). The guards live in
// ./seed/guards.js and are covered by tests/seed-guard.test.mjs. NEVER run it on a VPS or
// any database that holds real data.
// ─────────────────────────────────────────────────────────────

// The final roles are ADMIN, SUPPLIER and CUSTOMER. There is no role fallback any more:
// an out-of-date Prisma client fails fast instead of silently seeding the wrong role.
function resolveRoles() {
  if (!Role.ADMIN || !Role.SUPPLIER || !Role.CUSTOMER) {
    throw new Error("Role enum must contain ADMIN, SUPPLIER and CUSTOMER. Run `npx prisma generate`.");
  }

  if (Object.keys(Role).length !== 3) {
    throw new Error(
      `Role enum must have exactly ADMIN, SUPPLIER and CUSTOMER, found: ${Object.keys(Role).join(", ")}. Run \`npx prisma generate\`.`,
    );
  }

  return { ADMIN: Role.ADMIN, SUPPLIER: Role.SUPPLIER, CUSTOMER: Role.CUSTOMER };
}

// One TRUNCATE statement = atomic (all or nothing), FK-safe (CASCADE), resets autoincrement ids
// (RESTART IDENTITY) and automatically includes any table added by future migrations.
// The Prisma migration history (_prisma_migrations) and the schema itself are never touched.
async function resetDatabase(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT tablename::text AS tablename
    FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename <> '_prisma_migrations'
  `;

  if (!rows.length) {
    throw new Error("No tables found. Apply the migrations first.");
  }

  const list = rows
    .map((r) => `"${String(r.tablename).replace(/"/g, '""')}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function main() {
  for (const warning of removedFlagWarnings()) console.warn(`⚠️  ${warning}`);

  const { dbName, host } = assertSafeSeedTarget();
  const target = `${dbName}@${host}`;
  const randomSeed = Number(process.env.SEED_RANDOM_SEED ?? 1337);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const ctx = {
      prisma,
      rng: createRng(randomSeed),
      now: new Date(),
      roles: resolveRoles(),
    };

    // Tripwire: any user that is not a seed account means this database holds data we must not erase.
    const existing = await prisma.$queryRaw`SELECT "phone" FROM "User"`;
    assertOnlySeedUsers(existing.map((row) => row.phone));

    console.log(`🌱 Seeding "${target}" (random seed ${randomSeed})`);
    console.log("🧹 Resetting database...");
    await resetDatabase(prisma);

    const users = await seedUsers(ctx);
    const products = await seedProducts(ctx, { users });
    await seedShoppers(ctx, { users, products });
    const orders = await seedOrders(ctx, { users, products });
    await seedReviews(ctx, { users, products, orders });
    const tasks = await seedTasks(ctx, { users });
    await seedLogs(ctx, { users, products, orders, tasks });

    console.log("🔎 Verifying seeded data...");
    await verifySeed(prisma);

    printAccounts(users);
    console.log("✅ Database seeded successfully");
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
  }
}

function printAccounts(users) {
  console.log("\n🔑 Test accounts (password for all: see SEED_PASSWORD, default \"wwwwww\")");

  const rows = [
    ...users.admins.map((u) => ({ role: u.role, phone: u.phone, name: u.name, note: "" })),
    ...users.suppliers.map((u) => ({
      role: u.role,
      phone: u.phone,
      name: u.name,
      note: u.seedNote ?? "",
    })),
    ...users.customers
      .filter((u) => u.seedNote)
      .map((u) => ({ role: u.role, phone: u.phone, name: u.name, note: u.seedNote })),
  ];

  console.table(rows);
}

main().catch((err) => {
  // AggregateError (e.g. ECONNREFUSED) has an empty message; dig the real reason out.
  const reason =
    err?.message || err?.errors?.[0]?.message || err?.cause?.message || err?.code || String(err);
  console.error(err instanceof SeedRefusal ? "\n⛔ Seed refused:" : "\n❌ Seed failed:", String(reason).trim());
  if (process.env.SEED_DEBUG === "true") console.error(err);
  process.exit(1);
});
