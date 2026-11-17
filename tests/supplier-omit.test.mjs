// Proves the global Prisma `omit` for Product.supplierId (Prisma 7.8) behaves as designed:
//  * ordinary queries never return supplierId (top level, nested include, interactive tx)
//  * trusted internal code can still read it with an explicit `select` / `omit: false`
//  * writes and `where` filters on supplierId are unaffected
//  * a plain client WITHOUT omit does leak it (control: proves the test is meaningful)
// This is only a safety net: public routes must still use explicit `select`.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma";
import { prisma } from "@/lib/db";

const uid = () => Math.random().toString(36).slice(2, 10);
const control = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });

async function fixture() {
  const supplier = await prisma.user.create({ data: { name: "s", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x", role: "SUPPLIER", isPhoneVerified: true } });
  const category = await prisma.category.create({ data: { title: "c" + uid(), slug: "c-" + uid() } });
  const product = await prisma.product.create({
    data: { title: "p" + uid(), slug: "p-" + uid(), price: 1000, originalPrice: 1000, image: "x.webp", description: "d", stock: 3, isPublished: true, categoryId: category.id, supplierId: supplier.id },
  });
  return { supplier, category, product };
}

after(async () => {
  await prisma.$disconnect();
  await control.$disconnect();
});

test("omit: create with supplierId works, but the returned row does not expose it", async () => {
  const { supplier, product } = await fixture();
  assert.equal("supplierId" in product, false);
  const [raw] = await prisma.$queryRaw`SELECT "supplierId" FROM "Product" WHERE id = ${product.id}`;
  assert.equal(raw.supplierId, supplier.id, "the owner really is stored");
});

test("omit: findUnique / findFirst / findMany never return supplierId", async () => {
  const { product } = await fixture();
  const a = await prisma.product.findUnique({ where: { id: product.id } });
  const b = await prisma.product.findFirst({ where: { id: product.id } });
  const [c] = await prisma.product.findMany({ where: { id: product.id }, include: { images: true, specs: true, brand: true } });
  for (const row of [a, b, c]) assert.equal("supplierId" in row, false);
  assert.ok(!JSON.stringify([a, b, c]).includes("supplierId"));
});

test("omit: nested product includes (cart, order items, user relation) do not expose it", async () => {
  const { supplier, product } = await fixture();
  const customer = await prisma.user.create({ data: { name: "c", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x", isPhoneVerified: true } });
  await prisma.cartItem.create({ data: { userId: customer.id, productId: product.id, quantity: 1 } });
  const order = await prisma.order.create({
    data: { userId: customer.id, total: 1000, status: "PENDING", paymentStatus: "PENDING", receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890", items: { create: [{ productId: product.id, quantity: 1, price: 1000 }] } },
  });
  const cart = await prisma.cartItem.findMany({ where: { userId: customer.id }, include: { product: true } });
  const items = await prisma.orderItem.findMany({ where: { orderId: order.id }, include: { product: true } });
  const viaUser = await prisma.user.findUnique({ where: { id: supplier.id }, include: { suppliedProducts: true } });
  assert.equal("supplierId" in cart[0].product, false);
  assert.equal("supplierId" in items[0].product, false);
  assert.equal(viaUser.suppliedProducts.length, 1);
  assert.equal("supplierId" in viaUser.suppliedProducts[0], false);
});

test("omit: also applies inside interactive transactions", async () => {
  const { product } = await fixture();
  const row = await prisma.$transaction(async (tx) => tx.product.findUnique({ where: { id: product.id } }));
  assert.equal("supplierId" in row, false);
});

test("opt-in: explicit select returns supplierId; omit:false returns it; both only where asked", async () => {
  const { supplier, product } = await fixture();
  const sel = await prisma.product.findUnique({ where: { id: product.id }, select: { id: true, supplierId: true } });
  assert.deepEqual(sel, { id: product.id, supplierId: supplier.id });
  const opt = await prisma.product.findUnique({ where: { id: product.id }, omit: { supplierId: false } });
  assert.equal(opt.supplierId, supplier.id);
  const plain = await prisma.product.findUnique({ where: { id: product.id } });
  assert.equal("supplierId" in plain, false, "opting in once does not change later queries");
});

test("filters, ordering, counts and updates on supplierId still work", async () => {
  const { supplier, product } = await fixture();
  const found = await prisma.product.findMany({ where: { supplierId: supplier.id } });
  assert.deepEqual(found.map((p) => p.id), [product.id]);
  assert.equal(await prisma.product.count({ where: { supplierId: supplier.id } }), 1);
  assert.equal(await prisma.product.count({ where: { supplierId: null, id: product.id } }), 0);
  await prisma.product.update({ where: { id: product.id }, data: { stock: 9 } });
  const [raw] = await prisma.$queryRaw`SELECT "supplierId", stock FROM "Product" WHERE id = ${product.id}`;
  assert.equal(raw.supplierId, supplier.id, "unrelated update keeps the owner");
});

test("control: a client WITHOUT omit does return supplierId (the leak this layer prevents)", async () => {
  const { supplier, product } = await fixture();
  const leaked = await control.product.findUnique({ where: { id: product.id } });
  assert.equal(leaked.supplierId, supplier.id);
});

test("known limit: raw SQL ignores omit, so raw product queries must name their columns", async () => {
  const { product } = await fixture();
  const [row] = await prisma.$queryRaw`SELECT * FROM "Product" WHERE id = ${product.id}`;
  assert.ok("supplierId" in row);
});
