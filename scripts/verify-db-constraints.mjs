// Fails (exit 1) if the stock CHECK constraints are missing. Run after every deploy / restore:
//   DATABASE_URL=... node scripts/verify-db-constraints.mjs
// Never use `prisma db push` / `migrate reset` on production: CHECK constraints live only in SQL migrations.
import pg from "pg";

const REQUIRED = [
  "Product_stock_nonnegative_check",
  "Product_reservedStock_nonnegative_check",
  "Product_reservedStock_not_exceed_stock_check",
];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query("SELECT conname FROM pg_constraint WHERE conname = ANY($1)", [REQUIRED]);
await client.end();
const found = new Set(rows.map((r) => r.conname));
const missing = REQUIRED.filter((n) => !found.has(n));
if (missing.length) {
  console.error("MISSING CHECK CONSTRAINTS:", missing.join(", "));
  process.exit(1);
}
console.log("OK: all stock CHECK constraints present");
