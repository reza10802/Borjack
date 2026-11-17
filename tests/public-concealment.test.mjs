// Borjak is the only seller customers ever see. Suppliers are internal. These tests call the real
// public / customer-facing handlers and fail if anything about a supplier (id, name, phone, owner
// field) appears in the output. The server-rendered pages are covered by scripts/public-leak-check.mjs.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { PUBLIC_PRODUCT_SCALARS, INTERNAL_PRODUCT_COLUMNS, PUBLIC_CARD_SELECT, toPublicCardProduct } from "@/lib/public-product";
import { makeUser, makeProduct, loginAs, anonymous, req, call } from "./helpers/http.mjs";
import * as productsList from "@/app/api/products/route.js";
import * as productBySlug from "@/app/api/products/[slug]/route.js";
import * as cart from "@/app/api/cart/route.js";
import * as wishlist from "@/app/api/wishlist/route.js";
import * as orders from "@/app/api/order/route.js";

after(() => prisma.$disconnect());

const uid = () => Math.random().toString(36).slice(2, 8);

async function marketplace() {
  const tag = `ZQX${uid()}`; // unique marker inside the supplier's name
  const supplier = await makeUser("SUPPLIER", { name: `Shop ${tag} Owner` });
  const category = await prisma.category.create({ data: { title: `cat-${uid()}`, slug: `cat-${uid()}` } });
  const mk = (extra = {}) => prisma.product.create({
    data: { title: `p-${uid()}`, slug: `p-${uid()}`, price: 5000, originalPrice: 5000, image: "x.webp", description: "d", stock: 4, isPublished: true, categoryId: category.id, supplierId: supplier.id, ...extra },
  });
  const [main, related] = [await mk(), await mk()];
  const customer = await makeUser("CUSTOMER");
  const needles = [supplier.id, supplier.phone, tag, "supplierId", "ownerId"];
  const assertClean = (value, where) => {
    const text = JSON.stringify(value);
    for (const n of needles) assert.ok(!text.includes(n), `${where} leaks "${n}"`);
  };
  return { supplier, category, main, related, customer, assertClean };
}

test("schema guard: every Product column is classified as public or internal (a new column must be decided on purpose)", () => {
  const all = Object.keys(Prisma.ProductScalarFieldEnum).sort();
  const classified = [...Object.keys(PUBLIC_PRODUCT_SCALARS), ...INTERNAL_PRODUCT_COLUMNS].sort();
  assert.deepEqual(classified, all, "classify the new Product column in src/lib/public-product.js");
  for (const col of INTERNAL_PRODUCT_COLUMNS) assert.ok(!(col in PUBLIC_PRODUCT_SCALARS) && !(col in PUBLIC_CARD_SELECT));
});

test("card DTO: availableStock is computed and the raw stock fields are not passed on", () => {
  const dto = toPublicCardProduct({ id: 1, slug: "s", title: "t", price: 1, originalPrice: 1, discount: 0, stock: 5, reservedStock: 2, image: "i", rating: 0, reviewCount: 0, images: [], category: { title: "c" }, brand: null });
  assert.equal(dto.availableStock, 3);
  assert.deepEqual(Object.keys(dto).sort(), ["availableStock", "brand", "category", "discount", "id", "image", "isWishlisted", "originalPrice", "price", "rating", "reviewCount", "slug", "title"]);
});

test("public product list and detail (with related products) reveal nothing about the supplier", async () => {
  const m = await marketplace();
  anonymous();
  const list = await call(productsList.GET, req("GET", `/api/products?limit=100&search=${encodeURIComponent(m.main.title)}`));
  assert.equal(list.status, 200, JSON.stringify(list.body).slice(0, 200));
  assert.ok(JSON.stringify(list.body).includes(m.main.slug), "the product is really in the response");
  m.assertClean(list.body, "GET /api/products");

  const one = await call(productBySlug.GET, req("GET", `/api/products/${m.main.slug}`), { slug: m.main.slug });
  assert.equal(one.status, 200);
  assert.ok(JSON.stringify(one.body.relatedProducts).includes(m.related.slug), "related products are exercised too");
  m.assertClean(one.body, "GET /api/products/[slug]");
  assert.ok(!("reservedStock" in one.body));
});

test("product detail keeps exactly its previous public shape (behavior-preserving explicit select)", async () => {
  const m = await marketplace();
  anonymous();
  const one = await call(productBySlug.GET, req("GET", `/api/products/${m.main.slug}`), { slug: m.main.slug });
  assert.deepEqual(Object.keys(one.body).sort(), [
    "availableStock", "brand", "brandId", "category", "categoryId", "createdAt", "deletedAt", "description", "discount", "hasReviews", "id", "image", "images",
    "isPublished", "isWishlisted", "originalPrice", "price", "rating", "relatedProducts", "reviewCount", "reviews", "slug", "specs", "stock", "tags", "title", "updatedAt",
  ]);
});

test("a customer's cart, wishlist and order list reveal nothing about the supplier", async () => {
  const m = await marketplace();
  await prisma.cartItem.create({ data: { userId: m.customer.id, productId: m.main.id, quantity: 1 } });
  await prisma.wishlistItem.create({ data: { userId: m.customer.id, productId: m.related.id } });
  await prisma.order.create({
    data: { userId: m.customer.id, total: 5000, status: "PENDING", paymentStatus: "PENDING", receiverName: "r", receiverPhone: "09120000000", address: "a", provinceId: 1, provinceName: "p", cityId: 1, cityName: "c", postalCode: "1234567890", items: { create: [{ productId: m.main.id, quantity: 1, price: 5000 }] } },
  });
  await loginAs(m.customer);

  const c = await call(cart.GET, req("GET", "/api/cart"));
  assert.equal(c.status, 200); assert.ok(JSON.stringify(c.body).includes(m.main.slug));
  m.assertClean(c.body, "GET /api/cart");

  const w = await call(wishlist.GET, req("GET", "/api/wishlist"));
  assert.equal(w.status, 200); assert.ok(JSON.stringify(w.body).includes(m.related.slug));
  m.assertClean(w.body, "GET /api/wishlist");

  const o = await call(orders.GET, req("GET", "/api/order"));
  assert.equal(o.status, 200, JSON.stringify(o.body).slice(0, 200));
  assert.ok(JSON.stringify(o.body).includes(m.main.slug));
  m.assertClean(o.body, "GET /api/order");
});
