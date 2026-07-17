import "dotenv/config";

import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { seedUsers } from "./seed/users.js";
import { seedProducts } from "./seed/products.js";
import { seedOrders } from "./seed/orders.js";
import { seedReviews } from "./seed/reviews.js";
import { seedTasks } from "./seed/tasks.js";
import { seedLogs } from "./seed/logs.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {

  console.log(
    Object.keys(prisma).filter((k) => !k.startsWith("$") && !k.startsWith("_")),
  );

  console.log("🌱 Reset Database");

  await prisma.review.deleteMany();
  await prisma.productSpec.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.task.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  await seedUsers(prisma);

  await seedProducts(prisma);

  await seedOrders(prisma);

  await seedReviews(prisma);

  await seedTasks(prisma);

  await seedLogs(prisma);

  console.log("✅ Database seeded successfully");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
