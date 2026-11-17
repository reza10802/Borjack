// Role management, supplier lifecycle and ownership rules. Drives the REAL route handlers with
// real JWTs against the real test database (only `next/headers` is stubbed).
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { signSessionToken } from "@/lib/session";
import { settlePaidOrder, releaseReservationSafely, lockAndGetOrder } from "@/lib/payment-settlement";
import { reserveOrderStock } from "@/lib/stock-reservation";
import { ZARINPAL_GATEWAY_NAME } from "@/lib/zarinpal";
import { makeUser, makeProduct, loginAs, useToken, anonymous, req, call } from "./helpers/http.mjs";
import * as userById from "@/app/api/admin/users/[id]/route.js";
import * as users from "@/app/api/admin/users/route.js";
import * as adminProducts from "@/app/api/admin/products/route.js";
import * as adminProductById from "@/app/api/admin/products/[id]/route.js";
import * as restoreRoute from "@/app/api/admin/products/[id]/restore/route.js";
import * as register from "@/app/api/auth/register/route.js";

after(() => prisma.$disconnect());

const uid = () => Math.random().toString(36).slice(2, 10);
const patchUser = (id, body) => call(userById.PATCH, req("PATCH", `/api/admin/users/${id}`, body), { id });
const putUser = (id, body) => call(userById.PUT, req("PUT", `/api/admin/users/${id}`, body), { id });
const userRow = (id) => prisma.user.findUnique({ where: { id } });
const productRow = (id) => prisma.product.findUnique({ where: { id }, omit: { supplierId: false } });

async function supplierWithProducts(n = 2, extra = {}) {
  const s = await makeUser("SUPPLIER");
  const products = [];
  for (let i = 0; i < n; i++) products.push(await makeProduct(s, extra));
  return { supplier: s, products };
}

// ───────────────────────── who may change roles ─────────────────────────

test("role API: only an ADMIN may call it (anonymous 401; customer and supplier 403); roles stay unchanged", async () => {
  const target = await makeUser("CUSTOMER");
  anonymous();
  assert.equal((await patchUser(target.id, { role: "SUPPLIER" })).status, 401);
  for (const role of ["CUSTOMER", "SUPPLIER"]) {
    await loginAs(await makeUser(role));
    assert.equal((await patchUser(target.id, { role: "SUPPLIER" })).status, 403, `${role} must be refused`);
    assert.equal((await putUser(target.id, { isActive: false })).status, 403);
  }
  assert.equal((await userRow(target.id)).role, "CUSTOMER");
  assert.equal((await userRow(target.id)).isActive, true);
});

test("role API: nobody can change their own role; ADMIN accounts are untouchable; only CUSTOMER and SUPPLIER can be assigned", async () => {
  const admin = await makeUser("ADMIN");
  const otherAdmin = await makeUser("ADMIN");
  const customer = await makeUser("CUSTOMER");
  await loginAs(admin);
  assert.equal((await patchUser(admin.id, { role: "SUPPLIER" })).status, 400, "self change");
  assert.equal((await putUser(admin.id, { isActive: false })).status, 400, "self block");
  assert.equal((await patchUser(otherAdmin.id, { role: "CUSTOMER" })).status, 403, "ADMIN target");
  assert.equal((await putUser(otherAdmin.id, { isActive: false })).status, 403);
  for (const role of ["ADMIN", "MANAGER", "root", "", null, 5]) {
    assert.equal((await patchUser(customer.id, { role })).status, 400, `role ${JSON.stringify(role)} must be rejected`);
  }
  assert.equal((await userRow(customer.id)).role, "CUSTOMER");
  assert.equal((await userRow(otherAdmin.id)).role, "ADMIN");
});

test("register: a body carrying role SUPPLIER or ADMIN still creates a CUSTOMER", async () => {
  anonymous();
  for (const role of ["SUPPLIER", "ADMIN"]) {
    const phone = "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
    const r = await call(register.POST, req("POST", "/api/auth/register", { name: "Eve Tester", phone, password: "Str0ng!Passw0rd#2026", role }, { "x-forwarded-for": `198.51.100.${Math.floor(Math.random() * 250)}` }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal((await prisma.user.findUnique({ where: { phone } })).role, "CUSTOMER");
  }
});

// ───────────────────────── promotion ─────────────────────────

test("promotion: CUSTOMER to SUPPLIER bumps tokenVersion, kills old sessions and writes an audit entry", async () => {
  const admin = await makeUser("ADMIN");
  const customer = await makeUser("CUSTOMER");
  const oldToken = signSessionToken(customer);
  useToken(oldToken);
  assert.equal((await getSessionUser())?.id, customer.id, "old token valid before the change");

  await loginAs(admin);
  const r = await patchUser(customer.id, { role: "SUPPLIER" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.role, "SUPPLIER");

  const after = await userRow(customer.id);
  assert.equal(after.tokenVersion, customer.tokenVersion + 1);
  useToken(oldToken);
  assert.equal(await getSessionUser(), null, "the old session must be dead");

  const log = await prisma.auditLog.findFirst({ where: { entityType: "User", entityId: customer.id, action: "UPDATE_USER" } });
  assert.equal(log.userId, admin.id);
  assert.deepEqual(log.oldValue, { role: "CUSTOMER", isActive: true });
  assert.equal(log.newValue.role, "SUPPLIER");
});

test("promotion is refused for blocked accounts and for unverified phone numbers", async () => {
  await loginAs(await makeUser("ADMIN"));
  const blocked = await makeUser("CUSTOMER", { isActive: false });
  const unverified = await makeUser("CUSTOMER", { isPhoneVerified: false });
  assert.equal((await patchUser(blocked.id, { role: "SUPPLIER" })).status, 409);
  assert.equal((await patchUser(unverified.id, { role: "SUPPLIER" })).status, 409);
  assert.equal((await userRow(blocked.id)).role, "CUSTOMER");
  assert.equal((await userRow(unverified.id)).role, "CUSTOMER");
});

// ───────────────────────── demotion / block ─────────────────────────

async function financialSnapshot(productIds) {
  const items = await prisma.orderItem.findMany({ where: { productId: { in: productIds } }, orderBy: { id: "asc" } });
  const orderIds = [...new Set(items.map((i) => i.orderId))];
  const orders = await prisma.order.findMany({ where: { id: { in: orderIds } }, orderBy: { id: "asc" } });
  const tx = await prisma.transaction.findMany({ where: { orderId: { in: orderIds } }, orderBy: { id: "asc" } });
  const attempts = await prisma.paymentAttempt.findMany({ where: { orderId: { in: orderIds } }, orderBy: { id: "asc" } });
  return JSON.stringify({ items, orders, tx, attempts });
}

async function orderFor(customer, product, qty = 2, withPayment = true) {
  const order = await prisma.order.create({
    data: {
      userId: customer.id, total: product.price * qty, status: "PENDING", paymentStatus: "PENDING",
      receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890",
      items: { create: [{ productId: product.id, quantity: qty, price: product.price }] },
    },
    include: { items: true },
  });
  let authority = null;
  if (withPayment) {
    await prisma.$transaction((tx) => reserveOrderStock(tx, order, new Date(Date.now() + 900000)));
    authority = "A" + uid() + uid();
    await prisma.order.update({ where: { id: order.id }, data: { authority } });
    await prisma.transaction.create({ data: { orderId: order.id, authority, amount: order.total, status: "PENDING", gateway: ZARINPAL_GATEWAY_NAME } });
    await prisma.paymentAttempt.create({ data: { orderId: order.id, userId: customer.id, authority, amount: order.total } });
  }
  return { order, authority };
}
const reload = (id) => prisma.order.findUnique({ where: { id }, include: { items: true, transaction: true } });

test("demotion asks for confirmation first and changes nothing until it is given", async () => {
  const admin = await makeUser("ADMIN");
  const { supplier, products } = await supplierWithProducts(2);
  await loginAs(admin);
  const r = await patchUser(supplier.id, { role: "CUSTOMER" });
  assert.equal(r.status, 409);
  assert.equal(r.body.requiresConfirmation, true);
  assert.equal(r.body.productCount, 2);
  assert.equal((await userRow(supplier.id)).role, "SUPPLIER");
  for (const p of products) assert.equal((await productRow(p.id)).deletedAt, null);
});

test("demotion: role, archive and audit happen together; stock, orders and payments are untouched", async () => {
  const admin = await makeUser("ADMIN");
  const customer = await makeUser("CUSTOMER");
  const { supplier, products } = await supplierWithProducts(3);
  const [p1, p2] = products;
  await orderFor(customer, p1, 2);
  await prisma.cartItem.create({ data: { userId: customer.id, productId: p2.id, quantity: 1 } });
  const before = await financialSnapshot(products.map((p) => p.id));
  const stockBefore = await prisma.product.findMany({ where: { id: { in: products.map((p) => p.id) } }, select: { id: true, stock: true, reservedStock: true }, orderBy: { id: "asc" } });

  await loginAs(admin);
  const r = await patchUser(supplier.id, { role: "CUSTOMER", confirm: true });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.archivedProducts, 3);

  const after = await userRow(supplier.id);
  assert.equal(after.role, "CUSTOMER");
  assert.equal(after.tokenVersion, supplier.tokenVersion + 1);
  for (const p of products) {
    const row = await productRow(p.id);
    assert.ok(row.deletedAt, "archived");
    assert.equal(row.isPublished, false, "unpublished");
    assert.equal(row.supplierId, supplier.id, "ownership history is kept");
  }
  assert.deepEqual(await prisma.product.findMany({ where: { id: { in: products.map((p) => p.id) } }, select: { id: true, stock: true, reservedStock: true }, orderBy: { id: "asc" } }), stockBefore, "stock and reservedStock untouched");
  assert.equal(await financialSnapshot(products.map((p) => p.id)), before, "orders, items, payments untouched");
  assert.equal(await prisma.cartItem.count({ where: { productId: { in: products.map((p) => p.id) } } }), 0, "carts cleaned like a normal archive");

  const log = await prisma.auditLog.findFirst({ where: { entityType: "User", entityId: supplier.id, action: "UPDATE_USER" } });
  assert.equal(log.newValue.archivedProductCount, 3);
  assert.deepEqual([...log.newValue.archivedProductIds].sort(), products.map((p) => p.id).sort());
});

test("blocking a supplier retires the products too; unblocking and re-promoting republish nothing", async () => {
  const admin = await makeUser("ADMIN");
  const { supplier, products } = await supplierWithProducts(2);
  await loginAs(admin);
  assert.equal((await putUser(supplier.id, { isActive: false })).status, 409, "needs confirmation");
  const blocked = await putUser(supplier.id, { isActive: false, confirm: true });
  assert.equal(blocked.status, 200);
  assert.equal(blocked.body.archivedProducts, 2);
  assert.equal((await userRow(supplier.id)).isActive, false);

  assert.equal((await putUser(supplier.id, { isActive: true })).status, 200);
  for (const p of products) {
    const row = await productRow(p.id);
    assert.ok(row.deletedAt && row.isPublished === false, "still archived after unblock");
  }

  // demote, re-promote: still nothing republished
  assert.equal((await patchUser(supplier.id, { role: "CUSTOMER" })).status, 200, "no products left to retire, so no confirmation needed");
  assert.equal((await patchUser(supplier.id, { role: "SUPPLIER" })).status, 200);
  for (const p of products) assert.ok((await productRow(p.id)).deletedAt && (await productRow(p.id)).isPublished === false);

  // restore alone does not list the product
  const restored = await call(restoreRoute.POST ?? restoreRoute.PATCH, req("POST", `/api/admin/products/${products[0].id}/restore`), { id: String(products[0].id) });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  const row = await productRow(products[0].id);
  assert.equal(row.deletedAt, null);
  assert.equal(row.isPublished, false, "restore must not publish");
});

test("atomicity: if writing the audit entry fails, the role change, archive and token bump all roll back", async () => {
  const admin = await makeUser("ADMIN");
  const { supplier, products } = await supplierWithProducts(2);
  await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_audit() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'injected audit failure'; END $$ LANGUAGE plpgsql`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER test_fail_audit_${supplier.id} BEFORE INSERT ON "AuditLog" FOR EACH ROW WHEN (NEW."entityId" = '${supplier.id}') EXECUTE FUNCTION test_fail_audit()`);
  try {
    await loginAs(admin);
    const origError = console.error;
    console.error = () => {};
    const r = await patchUser(supplier.id, { role: "CUSTOMER", confirm: true });
    console.error = origError;
    assert.equal(r.status, 500);
    const row = await userRow(supplier.id);
    assert.equal(row.role, "SUPPLIER", "role not changed");
    assert.equal(row.tokenVersion, supplier.tokenVersion, "tokenVersion not bumped");
    for (const p of products) {
      const pr = await productRow(p.id);
      assert.equal(pr.deletedAt, null, "product not archived");
      assert.equal(pr.isPublished, true, "product still published");
    }
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS test_fail_audit_${supplier.id} ON "AuditLog"`);
  }
});

// ───────────── reserved stock + payment (accepted risk D-F, verified for real) ─────────────

test("active reservation: demotion still works and the reserved order settles normally afterwards", async () => {
  const admin = await makeUser("ADMIN");
  const customer = await makeUser("CUSTOMER");
  const { supplier, products: [p] } = await supplierWithProducts(1, { stock: 5 });
  const { order, authority } = await orderFor(customer, p, 2);
  assert.equal((await productRow(p.id)).reservedStock, 2);

  await loginAs(admin);
  assert.equal((await patchUser(supplier.id, { role: "CUSTOMER", confirm: true })).status, 200, "reservedStock > 0 must not block the admin");
  let row = await productRow(p.id);
  assert.ok(row.deletedAt); assert.equal(row.stock, 5); assert.equal(row.reservedStock, 2, "reservation untouched");

  const r = await settlePaidOrder({ order: await reload(order.id), authority, refId: "111" });
  assert.equal(r, "SUCCESS");
  const o = await reload(order.id);
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.status, "PROCESSING"); assert.equal(o.stockReservationStatus, "CONSUMED");
  row = await productRow(p.id);
  assert.equal(row.stock, 3); assert.equal(row.reservedStock, 0);
});

test("accepted risk: a LATE payment (after the reservation was released) for a retired product becomes ISSUE, without negative stock", async () => {
  const admin = await makeUser("ADMIN");
  const customer = await makeUser("CUSTOMER");
  const { supplier, products: [p] } = await supplierWithProducts(1, { stock: 5 });
  const { order, authority } = await orderFor(customer, p, 2);
  await prisma.$transaction(async (tx) => { const o = await lockAndGetOrder(tx, order.id, customer.id); await releaseReservationSafely(tx, o); });

  await loginAs(admin);
  assert.equal((await patchUser(supplier.id, { role: "CUSTOMER", confirm: true })).status, 200);

  const r = await settlePaidOrder({ order: await reload(order.id), authority, refId: "222" });
  assert.equal(r, "STOCK_ISSUE", "the paid-but-unfulfillable order is flagged for manual handling");
  const o = await reload(order.id);
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.stockReservationStatus, "ISSUE"); assert.equal(o.status, "CANCELLED");
  const row = await productRow(p.id);
  assert.equal(row.stock, 5, "stock not decremented"); assert.equal(row.reservedStock, 0);
});

// ───────────────────────── deleting users ─────────────────────────

test("DELETE user: 409 when they own products or have orders (nothing removed); a clean user is deleted", async () => {
  const admin = await makeUser("ADMIN");
  await loginAs(admin);
  const del = (id) => call(users.DELETE, req("DELETE", `/api/admin/users?userId=${id}`));

  const { supplier, products } = await supplierWithProducts(1);
  let r = await del(supplier.id);
  assert.equal(r.status, 409); assert.equal(r.body.productCount, 1);
  assert.ok(await userRow(supplier.id)); assert.ok(await productRow(products[0].id));

  // even after the products were retired, ownership history keeps the account
  assert.equal((await patchUser(supplier.id, { role: "CUSTOMER", confirm: true })).status, 200);
  assert.equal((await del(supplier.id)).status, 409);

  const buyer = await makeUser("CUSTOMER");
  const prod = await makeProduct(null);
  await orderFor(buyer, prod, 1, false);
  r = await del(buyer.id);
  assert.equal(r.status, 409); assert.equal(r.body.orderCount, 1);
  assert.ok(await userRow(buyer.id));

  const clean = await makeUser("CUSTOMER");
  assert.equal((await del(clean.id)).status, 200);
  assert.equal(await userRow(clean.id), null);
});

// ───────────────────────── product ownership + publishing ─────────────────────────

test("ownership: supplierId in any product body is rejected; admin-created products are Borjak-owned (NULL)", async () => {
  const admin = await makeUser("ADMIN");
  const supplier = await makeUser("SUPPLIER");
  const product = await makeProduct(null);
  await loginAs(admin);
  assert.equal((await call(adminProducts.POST, req("POST", "/api/admin/products", { title: "x", supplierId: supplier.id }))).status, 400);
  assert.equal((await call(adminProductById.PATCH, req("PATCH", `/api/admin/products/${product.id}`, { stock: 7, supplierId: supplier.id }), { id: String(product.id) })).status, 400);
  assert.equal((await productRow(product.id)).supplierId, null, "owner unchanged: no transfer path exists");
  assert.equal((await productRow(product.id)).stock, 5);
});

test("publish toggle: ADMIN only; refuses archived products and products whose owner is not an active SUPPLIER", async () => {
  const admin = await makeUser("ADMIN");
  const patchProduct = (id, body) => call(adminProductById.PATCH, req("PATCH", `/api/admin/products/${id}`, body), { id: String(id) });

  await loginAs(await makeUser("SUPPLIER"));
  const p = await makeProduct(null);
  assert.equal((await patchProduct(p.id, { isPublished: false })).status, 403, "supplier refused");
  await loginAs(await makeUser("CUSTOMER"));
  assert.equal((await patchProduct(p.id, { isPublished: false })).status, 403, "customer refused");
  assert.equal((await productRow(p.id)).isPublished, true);

  await loginAs(admin);
  assert.equal((await patchProduct(p.id, { isPublished: "yes" })).status, 400);
  assert.equal((await patchProduct(p.id, { isPublished: false, stock: 9 })).status, 400, "must be sent alone");
  assert.equal((await patchProduct(p.id, { isPublished: false })).status, 200);
  assert.equal((await productRow(p.id)).isPublished, false);
  assert.equal((await patchProduct(p.id, { isPublished: true })).status, 200, "Borjak-owned product can be published again");

  // owner is no longer an active supplier
  const { supplier, products: [sp] } = await supplierWithProducts(1);
  await prisma.product.update({ where: { id: sp.id }, data: { isPublished: false } });
  await prisma.user.update({ where: { id: supplier.id }, data: { role: "CUSTOMER" } });
  assert.equal((await patchProduct(sp.id, { isPublished: true })).status, 409);
  await prisma.user.update({ where: { id: supplier.id }, data: { role: "SUPPLIER", isActive: false } });
  assert.equal((await patchProduct(sp.id, { isPublished: true })).status, 409);
  await prisma.user.update({ where: { id: supplier.id }, data: { isActive: true } });
  assert.equal((await patchProduct(sp.id, { isPublished: true })).status, 200, "active supplier owner: allowed");

  // archived products cannot be published
  await prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date(), isPublished: false } });
  assert.equal((await patchProduct(p.id, { isPublished: true })).status, 409);
});

test("restore never re-lists a product whose owner is no longer an active supplier", async () => {
  const admin = await makeUser("ADMIN");
  const { supplier, products: [p] } = await supplierWithProducts(1);
  // archived the ordinary way (still flagged published), and the owner is demoted afterwards
  await prisma.product.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
  await prisma.user.update({ where: { id: supplier.id }, data: { role: "CUSTOMER" } });
  await loginAs(admin);
  const r = await call(restoreRoute.POST ?? restoreRoute.PATCH, req("POST", `/api/admin/products/${p.id}/restore`), { id: String(p.id) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = await productRow(p.id);
  assert.equal(row.deletedAt, null);
  assert.equal(row.isPublished, false);
});
