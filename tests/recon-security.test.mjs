import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { redactSensitive, getClientIp, ipBucketKey, maskPhone } from "@/lib/security";
import { signSessionToken, verifyJwt } from "@/lib/session";
import { strongPasswordSchema, verifyOtpSchema } from "@/lib/validations/auth";
import { safeJsonLd } from "@/lib/json-ld";
import { reconcileOrder, reconcileExpiredOrders } from "@/lib/payment-recon";
import { reserveOrderStock } from "@/lib/stock-reservation";
import { ZARINPAL_GATEWAY_NAME } from "@/lib/zarinpal";

process.env.ZARINPAL_MERCHANT_ID = "00000000-0000-0000-0000-000000000000";
const uid = () => Math.random().toString(36).slice(2, 10);

test("password policy: min 8, bcrypt 72-byte cap, common/numeric/repeated rejected", () => {
  for (const bad of ["123456", "12345678", "password", "aaaaaaaa", "12345678901", "x".repeat(40) + "é".repeat(20)]) {
    assert.equal(strongPasswordSchema.safeParse(bad).success, false, bad.slice(0, 12));
  }
  for (const good of ["Borjak#2026x", "کلمه-عبور-قوی۱۲", "abc12345xyz"]) {
    assert.equal(strongPasswordSchema.safeParse(good).success, true, good);
  }
});

test("OTP code accepts Persian/Arabic digits", () => {
  assert.equal(verifyOtpSchema.shape.code.safeParse("۱۲۳۴۵۶").data, "123456");
  assert.equal(verifyOtpSchema.shape.code.safeParse("١٢٣٤٥٦").data, "123456");
});

test("session JWT: carries tokenVersion, HS256 only, staff tokens are short-lived", () => {
  const t = signSessionToken({ id: "u1", phone: "0912", role: "ADMIN", tokenVersion: 3 });
  const p = verifyJwt(t);
  assert.equal(p.tv, 3); assert.equal(p.isPhoneVerified, true);
  assert.ok(p.exp - p.iat <= 8 * 3600);
  const u = verifyJwt(signSessionToken({ id: "u2", role: "CUSTOMER", tokenVersion: 0 }));
  assert.ok(u.exp - u.iat >= 6 * 86400);
  const hs512 = jwt.sign({ id: "x", isPhoneVerified: true }, process.env.JWT_SECRET, { algorithm: "HS512" });
  assert.throws(() => verifyJwt(hs512));
  assert.throws(() => verifyJwt(jwt.sign({ id: "x" }, "", { algorithm: "none" })));
});

test("audit redaction removes password/token/authority recursively", () => {
  const r = redactSensitive({ id: 1, password: "$2a$hash", nested: { apiKey: "k", ok: 1, list: [{ passwordHash: "h", name: "n" }] }, authority: "A" });
  assert.equal(r.password, "[REDACTED]"); assert.equal(r.nested.apiKey, "[REDACTED]");
  assert.equal(r.nested.list[0].passwordHash, "[REDACTED]"); assert.equal(r.authority, "[REDACTED]");
  assert.equal(r.id, 1); assert.equal(r.nested.ok, 1); assert.equal(r.nested.list[0].name, "n");
});

test("client IP: prefers X-Real-IP, otherwise LAST X-Forwarded-For hop; IPv6 limited per /64", () => {
  assert.equal(getClientIp(new Headers({ "x-real-ip": "5.5.5.5", "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "5.5.5.5");
  assert.equal(getClientIp(new Headers({ "x-forwarded-for": "6.6.6.6, 7.7.7.7" })), "7.7.7.7");
  assert.equal(ipBucketKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd"), ipBucketKey("2001:db8:1:2::1"));
  assert.notEqual(ipBucketKey("2001:db8:1:3::1"), ipBucketKey("2001:db8:1:2::1"));
  assert.equal(maskPhone("09123456789"), "0912***89");
});

test("JSON-LD serialization cannot break out of <script>", () => {
  const out = safeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.ok(!out.includes("</script>") && !out.includes("<"));
  assert.equal(JSON.parse(out).name, "</script><script>alert(1)</script>");
});

test("migration scrub removes password hashes from historical audit logs (record kept)", async () => {
  const u = await prisma.user.create({ data: { name: "a", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x" } });
  const log = await prisma.auditLog.create({ data: { userId: u.id, userLabel: "a", action: "DELETE_USER", entityType: "User", entityId: "1", description: "d", oldValue: { id: "1", password: "$2a$10$abc" } } });
  await prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET "oldValue" = "oldValue" - 'password' WHERE jsonb_typeof("oldValue") = 'object' AND "oldValue" ? 'password'`);
  const after = await prisma.auditLog.findUnique({ where: { id: log.id } });
  assert.equal(after.oldValue.password, undefined); assert.equal(after.oldValue.id, "1");
  // deleting the user keeps the audit trail (SetNull + userLabel)
  await prisma.user.delete({ where: { id: u.id } });
  const kept = await prisma.auditLog.findUnique({ where: { id: log.id } });
  assert.equal(kept.userId, null); assert.equal(kept.userLabel, "a");
});

async function expiredReserved({ expiredMs = -10 * 60 * 1000, existingUser } = {}) {
  const user = existingUser ?? await prisma.user.create({ data: { name: "t", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x", isPhoneVerified: true } });
  const cat = await prisma.category.create({ data: { title: "c" + uid(), slug: "c-" + uid() } });
  const product = await prisma.product.create({ data: { title: "p" + uid(), slug: "p-" + uid(), price: 1000, originalPrice: 1000, image: "/x.webp", description: "d", stock: 5, isPublished: true, categoryId: cat.id } });
  const authority = "A" + uid() + uid();
  const order = await prisma.order.create({
    data: { userId: user.id, total: 2000, status: "PENDING", paymentStatus: "PENDING", authority, receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890",
      items: { create: [{ productId: product.id, quantity: 2, price: 1000 }] } },
    include: { items: true },
  });
  await prisma.$transaction((tx) => reserveOrderStock(tx, order, new Date(Date.now() + expiredMs)));
  await prisma.transaction.create({ data: { orderId: order.id, authority, amount: 2000, status: "PENDING", gateway: ZARINPAL_GATEWAY_NAME } });
  await prisma.paymentAttempt.create({ data: { orderId: order.id, userId: user.id, authority, amount: 2000 } });
  return { user, product, order: await prisma.order.findUnique({ where: { id: order.id }, include: { items: true, transaction: true } }) };
}
const gatewayResponse = (body, ok = true) => ({ ok, json: async () => body });
const mockGateway = (...responses) => {
  const pending = [...responses];
  globalThis.fetch = async (url, options) => {
    const next = pending.shift();
    assert.ok(next, `unexpected extra gateway request: ${url}`);
    if (next.error) throw next.error;
    if (next.url) assert.ok(String(url).endsWith(next.url), `expected ${next.url}, received ${url}`);
    const payload = JSON.parse(options.body);
    assert.equal(payload.merchant_id, process.env.ZARINPAL_MERCHANT_ID);
    if (String(url).includes("inquiry.json")) {
      assert.deepEqual(Object.keys(payload).sort(), ["authority", "merchant_id"]);
    }
    if (String(url).includes("verify.json")) {
      assert.equal(typeof payload.amount, "number");
    }
    return gatewayResponse(next.body, next.ok ?? true);
  };
  return () => pending.length;
};
const inquiry = (status, code = 100) => ({
  url: "inquiry.json",
  body: { data: { status, code, message: "Success" }, errors: [] },
});
const verified = (code = 100, refId = 4242) => ({
  url: "verify.json",
  body: { data: { code, ref_id: refId, message: "Verified" }, errors: [] },
});
const stock = (id) => prisma.product.findUnique({ where: { id }, select: { stock: true, reservedStock: true } });

test("reconcile: Inquiry FAILED releases an expired reservation without calling Verify", async () => {
  const f = await expiredReserved();
  const remaining = mockGateway(inquiry("FAILED"));
  assert.equal(await reconcileOrder(f.order), "RELEASED");
  assert.equal(remaining(), 0);
  assert.equal((await stock(f.product.id)).reservedStock, 0);
  const afterRelease = await prisma.order.findUnique({ where: { id: f.order.id }, include: { transaction: true, items: true } });
  assert.equal(await reconcileOrder(afterRelease), "SKIPPED"); // idempotent: second run does nothing
  const o = afterRelease;
  assert.equal(o.stockReservationStatus, "RELEASED");
  assert.equal((await prisma.paymentAttempt.findUnique({ where: { authority: f.order.authority } })).status, "EXPIRED");
});

test("reconcile: invalid Authority (-54), unknown status and network error keep the reservation", async () => {
  const f = await expiredReserved();
  mockGateway({ url: "inquiry.json", body: { message: "Invalid authority", errors: { authority: ["Invalid authority.", "-54"] } }, ok: false });
  assert.equal(await reconcileOrder(f.order), "UNKNOWN_KEEP");
  globalThis.fetch = async () => { throw new Error("network"); };
  assert.equal(await reconcileOrder(f.order), "UNKNOWN_KEEP");
  assert.equal((await stock(f.product.id)).reservedStock, 2);
});

test("reconcile: Inquiry PAID then Verify 100 settles the order", async () => {
  const f = await expiredReserved();
  const remaining = mockGateway(inquiry("PAID"), verified(100, 4242));
  assert.equal(await reconcileOrder(f.order), "SETTLED");
  assert.equal(remaining(), 0);
  const o = await prisma.order.findUnique({ where: { id: f.order.id } });
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.stockReservationStatus, "CONSUMED"); assert.equal(o.refId, "4242");
  const s = await stock(f.product.id); assert.deepEqual({ stock: s.stock, r: s.reservedStock }, { stock: 3, r: 0 });
});

test("reconcile: Inquiry VERIFIED then Verify 101 is treated as already-paid", async () => {
  const f = await expiredReserved();
  mockGateway(inquiry("VERIFIED"), verified(101, 4243));
  assert.equal(await reconcileOrder(f.order), "SETTLED");
  const o = await prisma.order.findUnique({ where: { id: f.order.id } });
  assert.equal(o.paymentStatus, "PAID"); assert.equal(o.refId, "4243");
});

test("reconcile: REVERSED is sent to manual review and stock is not released", async () => {
  const f = await expiredReserved();
  const remaining = mockGateway(inquiry("REVERSED"));
  assert.equal(await reconcileOrder(f.order), "REVERSED_REVIEW");
  assert.equal(remaining(), 0);
  assert.equal((await stock(f.product.id)).reservedStock, 2);
  const attempt = await prisma.paymentAttempt.findUnique({ where: { authority: f.order.authority } });
  assert.equal(attempt.status, "REVIEW");
  assert.equal(await reconcileOrder(f.order), "REVIEW_REQUIRED");
});

test("reconcile: Inquiry PAID but Verify failure stays UNKNOWN and keeps stock", async () => {
  const f = await expiredReserved();
  mockGateway(inquiry("PAID"), { url: "verify.json", body: { data: { code: -54 }, errors: { authority: ["Invalid authority.", "-54"] } }, ok: false });
  assert.equal(await reconcileOrder(f.order), "UNKNOWN_KEEP");
  assert.equal((await stock(f.product.id)).reservedStock, 2);
});

test("reconcile: IN_BANK and not-yet-expired reservations are never released", async () => {
  const f = await expiredReserved();
  mockGateway(inquiry("IN_BANK"));
  assert.equal(await reconcileOrder(f.order), "UNKNOWN_KEEP");
  const g = await expiredReserved({ expiredMs: 10 * 60 * 1000 });
  globalThis.fetch = async () => { throw new Error("should not call gateway for a non-expired order"); };
  await reconcileExpiredOrders({ limit: 500, userId: g.user.id });
  assert.equal((await stock(g.product.id)).reservedStock, 2);
});


test("reconcile batch: UNKNOWN gets exponential backoff and is skipped until due", async () => {
  const f = await expiredReserved();
  const key = `recon:retry:${f.order.id}`;
  try {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls += 1;
      assert.ok(String(url).endsWith("inquiry.json"));
      return gatewayResponse({ data: { status: "IN_BANK", code: 100 }, errors: [] });
    };

    const first = await reconcileExpiredOrders({ limit: 5, userId: f.user.id, timeBudgetMs: 5_000 });
    assert.equal(first.processed, 1);
    assert.equal(first.summary.UNKNOWN_KEEP, 1);
    const firstRetry = await prisma.rateLimitBucket.findUnique({ where: { key } });
    assert.ok(firstRetry);
    assert.equal(firstRetry.count, 1);
    assert.ok(firstRetry.windowStart.getTime() > Date.now());

    // Make the retry due, then verify that the next backoff interval grows.
    await prisma.rateLimitBucket.update({ where: { key }, data: { windowStart: new Date(Date.now() - 1_000) } });
    globalThis.fetch = async (url) => {
      calls += 1;
      assert.ok(String(url).endsWith("inquiry.json"));
      return gatewayResponse({ data: { status: "IN_BANK", code: 100 }, errors: [] });
    };
    const second = await reconcileExpiredOrders({ limit: 5, userId: f.user.id, timeBudgetMs: 5_000 });
    assert.equal(second.processed, 1);
    const secondRetry = await prisma.rateLimitBucket.findUnique({ where: { key } });
    assert.equal(secondRetry.count, 2);
    assert.ok(secondRetry.windowStart.getTime() - Date.now() >= 9 * 60_000);

    globalThis.fetch = async () => { throw new Error("retry must not run before nextRetryAt"); };
    const skipped = await reconcileExpiredOrders({ limit: 5, userId: f.user.id, timeBudgetMs: 5_000 });
    assert.equal(skipped.processed, 0);
    assert.equal(calls, 2);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  }
});

test("reconcile batch: a future retry does not block a newer due order", async () => {
  const user = await prisma.user.create({ data: { name: "queue", phone: "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"), password: "x", isPhoneVerified: true } });
  const blocked = await expiredReserved({ existingUser: user, expiredMs: -20 * 60 * 1000 });
  const due = await expiredReserved({ existingUser: user, expiredMs: -10 * 60 * 1000 });
  const blockedKey = `recon:retry:${blocked.order.id}`;
  const dueKey = `recon:retry:${due.order.id}`;
  try {
    await prisma.rateLimitBucket.create({
      data: { key: blockedKey, count: 4, windowStart: new Date(Date.now() + 10 * 60_000) },
    });
    globalThis.fetch = async (url) => {
      assert.ok(String(url).endsWith("inquiry.json"));
      return gatewayResponse({ data: { status: "IN_BANK", code: 100 }, errors: [] });
    };

    const result = await reconcileExpiredOrders({ limit: 1, userId: user.id, timeBudgetMs: 5_000 });
    assert.equal(result.processed, 1);
    assert.equal(result.summary.UNKNOWN_KEEP, 1);
    assert.equal(await prisma.rateLimitBucket.findUnique({ where: { key: dueKey } }) !== null, true);
    assert.equal((await prisma.rateLimitBucket.findUnique({ where: { key: blockedKey } })).count, 4);
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [blockedKey, dueKey] } } });
  }
});

test("reconcile batch: database lease prevents duplicate concurrent gateway work", async () => {
  const f = await expiredReserved();
  const leaseKey = `recon:lease:${f.order.id}`;
  const retryKey = `recon:retry:${f.order.id}`;
  try {
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.ok(String(url).endsWith("inquiry.json"));
      return gatewayResponse({ data: { status: "IN_BANK", code: 100 }, errors: [] });
    };

    const [a, b] = await Promise.all([
      reconcileExpiredOrders({ limit: 1, userId: f.user.id, timeBudgetMs: 5_000 }),
      reconcileExpiredOrders({ limit: 1, userId: f.user.id, timeBudgetMs: 5_000 }),
    ]);
    assert.equal(a.processed + b.processed, 1);
    assert.equal(calls, 1);
    assert.equal(await prisma.rateLimitBucket.findUnique({ where: { key: leaseKey } }), null);
    assert.ok(await prisma.rateLimitBucket.findUnique({ where: { key: retryKey } }));
  } finally {
    await prisma.rateLimitBucket.deleteMany({ where: { key: { in: [leaseKey, retryKey] } } });
  }
});

test("reconcile batch: zero time budget makes no gateway request", async () => {
  let called = false;
  globalThis.fetch = async () => { called = true; throw new Error("must not call gateway"); };
  const result = await reconcileExpiredOrders({ limit: 10, timeBudgetMs: 0 });
  assert.equal(result.processed, 0);
  assert.equal(result.timeBudgetExceeded, true);
  assert.equal(called, false);
});


test("reconcile batch: REVIEW orders are excluded from future automatic queue runs", async () => {
  const f = await expiredReserved();
  globalThis.fetch = async (url) => {
    assert.ok(String(url).endsWith("inquiry.json"));
    return gatewayResponse({ data: { status: "REVERSED", code: 100 }, errors: [] });
  };

  const first = await reconcileExpiredOrders({ limit: 5, userId: f.user.id, timeBudgetMs: 5_000 });
  assert.equal(first.summary.REVERSED_REVIEW, 1);
  assert.equal((await prisma.paymentAttempt.findUnique({ where: { authority: f.order.authority } })).status, "REVIEW");

  globalThis.fetch = async () => { throw new Error("REVIEW order must not be sent to the gateway again"); };
  const second = await reconcileExpiredOrders({ limit: 5, userId: f.user.id, timeBudgetMs: 5_000 });
  assert.equal(second.processed, 0);
});

test.after(async () => { await prisma.$disconnect(); });
