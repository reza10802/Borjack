// Supplier panel isolation: what a SUPPLIER can see, what they can never reach, and that the
// admin API is closed to everyone except ADMIN. Real handlers, real JWTs, real database.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { signSessionToken } from "@/lib/session";
import { makeUser, makeProduct, loginAs, useToken, anonymous, req, call } from "./helpers/http.mjs";
import * as list from "@/app/api/supplier/products/route.js";
import * as detail from "@/app/api/supplier/products/[id]/route.js";
import { proxy } from "@/proxy.js";
import * as userById from "@/app/api/admin/users/[id]/route.js";

after(() => prisma.$disconnect());

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const getList = (qs = "") => call(list.GET, req("GET", `/api/supplier/products${qs}`));
const getOne = (id) => call(detail.GET, req("GET", `/api/supplier/products/${id}`), { id: String(id) });

async function world() {
  const a = await makeUser("SUPPLIER");
  const b = await makeUser("SUPPLIER");
  const pa = [await makeProduct(a), await makeProduct(a), await makeProduct(a)];
  const pb = [await makeProduct(b), await makeProduct(b)];
  const borjak = await makeProduct(null);
  return { a, b, pa, pb, borjak };
}

test("supplier API: anonymous 401; customer and ADMIN 403", async () => {
  const w = await world();
  anonymous();
  assert.equal((await getList()).status, 401);
  assert.equal((await getOne(w.pa[0].id)).status, 401);
  for (const role of ["CUSTOMER", "ADMIN"]) {
    await loginAs(await makeUser(role));
    assert.equal((await getList()).status, 403, `${role} list`);
    assert.equal((await getOne(w.pa[0].id)).status, 403, `${role} detail`);
  }
});

test("supplier API: a supplier sees exactly their own products, never anyone else's or Borjak's", async () => {
  const w = await world();
  await loginAs(w.a);
  const r = await getList("?limit=50");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.items.map((p) => p.id).sort(), w.pa.map((p) => p.id).sort());
  assert.equal(r.body.pagination.total, 3);
  assert.equal(r.body.counts.all, 3);

  await loginAs(w.b);
  assert.deepEqual((await getList("?limit=50")).body.items.map((p) => p.id).sort(), w.pb.map((p) => p.id).sort());
});

test("supplier API: the supplier id can never come from the request", async () => {
  const w = await world();
  await loginAs(w.a);
  for (const qs of [`?supplierId=${w.b.id}`, `?ownerId=${w.b.id}&supplier=${w.b.id}`, `?userId=${w.b.id}`]) {
    const r = await getList(qs + "&limit=50");
    assert.deepEqual(r.body.items.map((p) => p.id).sort(), w.pa.map((p) => p.id).sort(), qs);
  }
});

test("supplier API: another supplier's, a Borjak, a missing and a malformed product id are all the same 404", async () => {
  const w = await world();
  await loginAs(w.a);
  const own = await getOne(w.pa[0].id);
  assert.equal(own.status, 200);
  assert.equal(own.body.product.id, w.pa[0].id);

  const responses = [];
  for (const id of [w.pb[0].id, w.borjak.id, 999999999, "abc", "1e3", "-1", "0", "1 OR 1=1", "9".repeat(30)]) {
    const r = await getOne(id);
    assert.equal(r.status, 404, `id ${id}`);
    responses.push(JSON.stringify(r.body));
  }
  assert.equal(new Set(responses).size, 1, "no response may reveal whether the id exists");
});

test("supplier API: only an allowlist of fields is returned; supplierId and review internals never are", async () => {
  const w = await world();
  await loginAs(w.a);
  const expected = ["brand", "category", "createdAt", "deletedAt", "discount", "id", "image", "isPublished", "originalPrice", "price", "reservedStock", "slug", "stock", "title", "updatedAt"];
  const l = await getList();
  for (const item of l.body.items) assert.deepEqual(Object.keys(item).sort(), expected);
  const d = await getOne(w.pa[0].id);
  assert.deepEqual(Object.keys(d.body.product).sort(), [...expected, "description"].sort());
  assert.ok(!JSON.stringify([l.body, d.body]).includes("supplierId"));
  assert.ok(!JSON.stringify([l.body, d.body]).includes(w.a.id), "not even the owner's own id is echoed");
});

test("supplier API: pagination, status filters and dashboard counts", async () => {
  const w = await world();
  await prisma.product.update({ where: { id: w.pa[1].id }, data: { isPublished: false } });
  await prisma.product.update({ where: { id: w.pa[2].id }, data: { deletedAt: new Date(), isPublished: false } });
  await prisma.product.update({ where: { id: w.pa[0].id }, data: { stock: 0 } });
  await loginAs(w.a);
  const all = await getList("?limit=2&page=2");
  assert.equal(all.body.items.length, 1);
  assert.deepEqual(all.body.pagination, { page: 2, limit: 2, total: 3, totalPages: 2 });
  assert.deepEqual(all.body.counts, { all: 3, published: 1, unpublished: 1, archived: 1, outOfStock: 1 });
  assert.deepEqual((await getList("?status=archived")).body.items.map((p) => p.id), [w.pa[2].id]);
  assert.deepEqual((await getList("?status=unpublished")).body.items.map((p) => p.id), [w.pa[1].id]);
  assert.equal((await getList("?status=bogus")).body.pagination.total, 3, "unknown filter falls back to all");
  assert.equal((await getList("?limit=9999&page=-4")).body.pagination.limit, 50, "limit is capped");
});

test("supplier API: a demoted supplier's old session stops working immediately", async () => {
  const w = await world();
  const stale = signSessionToken(await prisma.user.findUnique({ where: { id: w.a.id } }));
  useToken(stale);
  assert.equal((await getList()).status, 200);
  await loginAs(await makeUser("ADMIN"));
  const r = await call(userById.PATCH, req("PATCH", `/api/admin/users/${w.a.id}`, { role: "CUSTOMER", confirm: true }), { id: w.a.id });
  assert.equal(r.status, 200);
  useToken(stale);
  assert.equal((await getList()).status, 401);
  await loginAs(w.a);
  assert.equal((await getList()).status, 403, "a fresh login as a plain customer is refused too");
});

// ───────────────────────── the admin API is closed to everyone but ADMIN ─────────────────────────

function adminRouteFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? adminRouteFiles(p) : e.name === "route.js" ? [p] : [];
  });
}

test("every /api/admin handler refuses anonymous (401) and customer / supplier (403), without side effects", async () => {
  const files = adminRouteFiles(path.join(root, "src/app/api/admin"));
  assert.ok(files.length >= 15, "route discovery works");
  const w = await world();
  const customer = await makeUser("CUSTOMER");
  const before = JSON.stringify(await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "User")::int u, (SELECT COUNT(*) FROM "Product")::int p, (SELECT COUNT(*) FROM "Order")::int o, (SELECT COUNT(*) FROM "Task")::int t, (SELECT COUNT(*) FROM "Review")::int r, (SELECT COUNT(*) FROM "Category")::int c`);
  const snapshot = JSON.stringify(await prisma.product.findMany({ where: { id: { in: w.pa.map((p) => p.id) } }, orderBy: { id: "asc" } }));
  let handlers = 0;

  for (const file of files) {
    const mod = await import(pathToFileURL(file).href);
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (typeof mod[method] !== "function") continue;
      handlers += 1;
      const label = `${method} ${path.relative(path.join(root, "src/app"), file)}`;
      const params = { id: String(w.pa[0].id), slug: "x" };
      const ask = () => call(mod[method], req(method, `/api/admin/x?userId=${customer.id}`, method === "GET" || method === "DELETE" ? undefined : { role: "SUPPLIER", stock: 1, title: "t" }), params);

      anonymous();
      assert.ok([401, 403].includes((await ask()).status), `${label}: anonymous must be refused`);
      await loginAs(customer);
      assert.equal((await ask()).status, 403, `${label}: customer must get 403`);
      await loginAs(w.a);
      assert.equal((await ask()).status, 403, `${label}: supplier must get 403`);
    }
  }

  assert.ok(handlers >= 20, `expected to exercise at least 20 admin handlers, got ${handlers}`);
  const after = JSON.stringify(await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "User")::int u, (SELECT COUNT(*) FROM "Product")::int p, (SELECT COUNT(*) FROM "Order")::int o, (SELECT COUNT(*) FROM "Task")::int t, (SELECT COUNT(*) FROM "Review")::int r, (SELECT COUNT(*) FROM "Category")::int c`);
  assert.equal(after, before, "refused calls must not change any data");
  assert.equal(JSON.stringify(await prisma.product.findMany({ where: { id: { in: w.pa.map((p) => p.id) } }, orderBy: { id: "asc" } })), snapshot);
});

// ───────────────────────── page gate (proxy.js) ─────────────────────────

async function gate(pathname, user) {
  const headers = {};
  if (user) headers.cookie = `token=${signSessionToken(user)}`;
  const res = await proxy(new NextRequest(`http://localhost${pathname}`, { headers }));
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname + new URL(loc).search : "next";
}

test("page gate: /supplier is SUPPLIER-only and /admin is ADMIN-only", async () => {
  const [admin, supplier, customer] = [await makeUser("ADMIN"), await makeUser("SUPPLIER"), await makeUser("CUSTOMER")];

  for (const p of ["/supplier", "/supplier/products"]) {
    assert.equal(await gate(p, supplier), "next", `supplier on ${p}`);
    assert.equal(await gate(p, customer), "/403", `customer on ${p}`);
    assert.equal(await gate(p, admin), "/403", `admin on ${p}`);
    assert.match(await gate(p, null), /^\/login\?redirect=/, `anonymous on ${p}`);
  }
  for (const p of ["/admin", "/admin/users", "/admin/products"]) {
    assert.equal(await gate(p, admin), "next", `admin on ${p}`);
    assert.equal(await gate(p, supplier), "/403", `supplier on ${p}`);
    assert.equal(await gate(p, customer), "/403", `customer on ${p}`);
    assert.match(await gate(p, null), /^\/login\?redirect=/);
  }
  assert.equal(await gate("/", customer), "next");
});
