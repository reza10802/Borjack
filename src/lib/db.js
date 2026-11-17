import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis;

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    // Defence in depth, NOT a replacement for explicit `select` on public routes:
    // the internal owner of a product must never leak by default. Trusted internal
    // code opts in with `select: { supplierId: true }` or `omit: { supplierId: false }`.
    omit: {
      product: {
        supplierId: true,
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
export const db = prisma;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
