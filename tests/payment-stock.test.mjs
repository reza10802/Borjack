import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import {
  reserveOrderStock,
  tryReserveOrderStock, findPriceMismatches, StockUnavailableError,
  restoreOrderStockForCancellation,
} from "@/lib/stock-reservation";
import { settleSuccessfulPayment, settlePaidOrder, releaseReservationSafely, lockAndGetOrder } from "@/lib/payment-settlement";
import { ZARINPAL_GATEWAY_NAME } from "@/lib/zarinpal";

const uid = () => Math.random().toString(36).slice(2, 10);

async function fixture({ stock = 5, qty = 2, price = 1000, cartQty = 0 } = {}) {
  const user = await prisma.user.create({ data: { name: "t", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x", isPhoneVerified: true } });
  const category = await prisma.category.create({ data: { title: "c" + uid(), slug: "c-" + uid() } });
  const product = await prisma.product.create({ data: { title: "p" + uid(), slug: "p-" + uid(), price, originalPrice: price, image: "/x.webp", description: "d", stock, isPublished: true, categoryId: category.id } });
  const order = await prisma.order.create({
    data: {
      userId: user.id, total: price * qty, status: "PENDING", paymentStatus: "PENDING",
      receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890",
      items: { create: [{ productId: product.id, quantity: qty, price }] },
    },
    include: { items: true },
  });
  if (cartQty) await prisma.cartItem.create({ data: { userId: user.id, productId: product.id, quantity: cartQty } });
  return { user, product, order };
}
const reload = (id) => prisma.order.findUnique({ where: { id }, include: { items: true, transaction: true } });
const stockOf = (id) => prisma.product.findUnique({ where: { id }, select: { stock: true, reservedStock: true } });

test("concurrent reservations never oversell (stock=5, 8 orders x2)", async () => {
  const f = await fixture({ stock: 5, qty: 2 });
  const orders = [f.order];
  for (let i = 0; i < 7; i++) {
    orders.push(await prisma.order.create({
      data: { userId: f.user.id, total: 2000, status: "PENDING", paymentStatus: "PENDING", receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890",
        items: { create: [{ productId: f.product.id, quantity: 2, price: 1000 }] } },
      include: { items: true },
    }));
  }
  const results = await Promise.allSettled(orders.map((o) =>
    prisma.$transaction((tx) => reserveOrderStock(tx, o, new Date(Date.now() + 900000)))));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  assert.equal(ok, 2, "only floor(5/2)=2 reservations may succeed");
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason instanceof StockUnavailableError || /constraint|check/i.test(String(r.reason))));
  const s = await stockOf(f.product.id);
  assert.equal(s.reservedStock, 4); assert.equal(s.stock, 5);
});

test("DB CHECK constraints reject negative / over-reserved stock", async () => {
  const f = await fixture({ stock: 1 });
  await assert.rejects(prisma.$executeRaw`UPDATE "Product" SET "stock" = -1 WHERE id = ${f.product.id}`);
  await assert.rejects(prisma.$executeRaw`UPDATE "Product" SET "reservedStock" = 9 WHERE id = ${f.product.id}`);
});

test("release is idempotent (no double release / negative reserved)", async () => {
  const f = await fixture({ stock: 5, qty: 2 });
  await prisma.$transaction((tx) => reserveOrderStock(tx, f.order, new Date(Date.now() + 900000)));
  const reserved = await reload(f.order.id);
  const rs = await Promise.all(Array.from({ length: 5 }, () => prisma.$transaction(async (tx) => {
    const o = await lockAndGetOrder(tx, f.order.id, f.user.id);
    return releaseReservationSafely(tx, o);
  })));
  assert.equal(rs.filter(Boolean).length, 1);
  assert.equal((await stockOf(f.product.id)).reservedStock, 0);
  assert.equal(reserved.stockReservationStatus, "RESERVED");
});

async function payReady(f) {
  await prisma.$transaction((tx) => reserveOrderStock(tx, f.order, new Date(Date.now() + 900000)));
  const authority = "A" + uid() + uid();
  await prisma.order.update({ where: { id: f.order.id }, data: { authority } });
  await prisma.transaction.create({ data: { orderId: f.order.id, authority, amount: f.order.total, status: "PENDING", gateway: ZARINPAL_GATEWAY_NAME } });
  await prisma.paymentAttempt.create({ data: { orderId: f.order.id, userId: f.user.id, authority, amount: f.order.total } });
  return authority;
}

test("payment settlement is idempotent under duplicate/replayed callbacks; stock consumed once", async () => {
  const f = await fixture({ stock: 5, qty: 2, cartQty: 5 });
  const authority = await payReady(f);
  const order = await reload(f.order.id);
  const rs = await Promise.all(Array.from({ length: 6 }, () => settlePaidOrder({ order, authority, refId: "123456" })));
  assert.ok(rs.every((r) => r === "SUCCESS"));
  const s = await stockOf(f.product.id);
  assert.deepEqual({ stock: s.stock, reserved: s.reservedStock }, { stock: 3, reserved: 0 });
  const o = await reload(f.order.id);
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.status, "PROCESSING"); assert.equal(o.stockReservationStatus, "CONSUMED");
  // CART-02: only the purchased quantity is removed (5 in cart - 2 bought = 3 stay)
  const ci = await prisma.cartItem.findFirst({ where: { userId: f.user.id, productId: f.product.id } });
  assert.equal(ci?.quantity, 3);
});

test("late successful payment after release re-reserves stock instead of cancelling the order", async () => {
  const f = await fixture({ stock: 5, qty: 2 });
  const authority = await payReady(f);
  await prisma.$transaction(async (tx) => { const o = await lockAndGetOrder(tx, f.order.id, f.user.id); await releaseReservationSafely(tx, o); });
  const order = await reload(f.order.id);
  assert.equal(order.stockReservationStatus, "RELEASED");
  const r = await settlePaidOrder({ order, authority, refId: "777" });
  assert.equal(r, "SUCCESS");
  const o = await reload(f.order.id);
  assert.equal(o.status, "PROCESSING"); assert.equal(o.stockReservationStatus, "CONSUMED");
  assert.equal((await stockOf(f.product.id)).stock, 3);
});

test("late payment with no stock left becomes ISSUE (paid but cancelled) without negative stock", async () => {
  const f = await fixture({ stock: 2, qty: 2 });
  const authority = await payReady(f);
  await prisma.$transaction(async (tx) => { const o = await lockAndGetOrder(tx, f.order.id, f.user.id); await releaseReservationSafely(tx, o); });
  await prisma.product.update({ where: { id: f.product.id }, data: { stock: 1 } }); // someone else bought it
  const r = await settlePaidOrder({ order: await reload(f.order.id), authority, refId: "888" });
  assert.equal(r, "STOCK_ISSUE");
  const o = await reload(f.order.id);
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.stockReservationStatus, "ISSUE"); assert.equal(o.status, "CANCELLED");
  assert.equal((await stockOf(f.product.id)).stock, 1);
});

test("restock on cancellation is exactly-once and only for CONSUMED orders", async () => {
  const f = await fixture({ stock: 5, qty: 2 });
  const authority = await payReady(f);
  await settlePaidOrder({ order: await reload(f.order.id), authority, refId: "1" });
  assert.equal((await stockOf(f.product.id)).stock, 3);
  const rs = await Promise.all(Array.from({ length: 5 }, () => prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${f.order.id} FOR UPDATE`;
    return restoreOrderStockForCancellation(
      tx,
      await tx.order.findUnique({ where: { id: f.order.id }, include: { items: true } }),
    );
  })));
  assert.equal(rs.filter((r) => r.restocked).length, 1);
  assert.equal((await stockOf(f.product.id)).stock, 5);
  // a never-paid order must not be restocked
  const g = await fixture({ stock: 5, qty: 1 });
  const ok = await prisma.$transaction((tx) => restoreOrderStockForCancellation(tx, g.order));
  assert.deepEqual(ok, { restocked: false, reservationReleased: false });
  assert.equal((await stockOf(g.product.id)).stock, 5);
});

test("cancelling a paid RESERVED order releases the hold without consuming or inflating stock", async () => {
  const f = await fixture({ stock: 5, qty: 2 });
  await prisma.$transaction((tx) => reserveOrderStock(tx, f.order, new Date(Date.now() + 900000)));
  await prisma.order.update({
    where: { id: f.order.id },
    data: { status: "PROCESSING", paymentStatus: "PAID" },
  });

  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${f.order.id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id: f.order.id }, include: { items: true } });
    const inventory = await restoreOrderStockForCancellation(tx, order);
    await tx.order.update({ where: { id: f.order.id }, data: { status: "CANCELLED" } });
    return inventory;
  });

  assert.deepEqual(outcome, { restocked: false, reservationReleased: true });
  const cancelled = await reload(f.order.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.paymentStatus, "PAID");
  assert.equal(cancelled.stockReservationStatus, "RELEASED");
  assert.equal(cancelled.stockRestockedAt, null);
  assert.deepEqual(await stockOf(f.product.id), { stock: 5, reservedStock: 0 });

  // Replaying the cancellation inventory step from a fresh row must be a no-op.
  const replay = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: f.order.id }, include: { items: true } });
    return restoreOrderStockForCancellation(tx, current);
  });
  assert.deepEqual(replay, { restocked: false, reservationReleased: false });
  assert.deepEqual(await stockOf(f.product.id), { stock: 5, reservedStock: 0 });
});

test("price drift is detected before reservation/payment (stale-price policy)", async () => {
  const f = await fixture({ price: 1000 });
  assert.equal((await prisma.$transaction((tx) => findPriceMismatches(tx, f.order))).length, 0);
  await prisma.product.update({ where: { id: f.product.id }, data: { price: 1500 } });
  assert.equal((await prisma.$transaction((tx) => findPriceMismatches(tx, f.order))).length, 1);
});

test.after(async () => { await prisma.$disconnect(); });
