// Helpers to drive the REAL route handlers in tests: real JWTs, real database, only
// `next/headers` is stubbed. Nothing in the application code is mocked.
import { prisma } from "@/lib/db";
import { signSessionToken } from "@/lib/session";

let seq = 0;
const phone = () => "09" + String(Date.now() % 1e8).padStart(8, "0").slice(-8) + String(seq++ % 10);

export async function makeUser(role = "CUSTOMER", extra = {}) {
  seq += 1;
  const p = "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  return prisma.user.create({
    data: { name: `${role.toLowerCase()}-${seq}`, phone: p, password: "x", role, isPhoneVerified: true, isActive: true, ...extra },
  });
}

export async function makeProduct(owner, extra = {}) {
  const category = await (async () => {
    const slug = "cat-" + Math.random().toString(36).slice(2, 9);
    return prisma.category.create({ data: { title: slug, slug } });
  })();
  const slug = "p-" + Math.random().toString(36).slice(2, 10);
  return prisma.product.create({
    data: {
      title: slug, slug, price: 1000, originalPrice: 1000, image: "x.webp", description: "d",
      stock: 5, isPublished: true, categoryId: category.id, supplierId: owner?.id ?? null, ...extra,
    },
  });
}

// Make the next handler calls run as `user` (a fresh token that matches the DB's tokenVersion).
export async function loginAs(user) {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  globalThis.__testRequest = { cookies: { token: signSessionToken(fresh) }, headers: { "x-forwarded-for": "203.0.113.9" } };
  return fresh;
}

export function useToken(token) {
  globalThis.__testRequest = { cookies: token ? { token } : {}, headers: {} };
}

export const anonymous = () => useToken(null);

export function req(method, url, body, headers = {}) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// Calls a route handler and returns { status, body }.
export async function call(handler, request, params = {}) {
  const res = await handler(request, { params: Promise.resolve(params) });
  let body = null;
  try { body = await res.json(); } catch { /* empty */ }
  return { status: res.status, body };
}
