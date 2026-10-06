// src/middleware.js

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const secret = new TextEncoder().encode(JWT_SECRET);

const ADMIN_ONLY_PAGES = [
  "/admin/users",
  "/admin/staff",
  "/admin/logs",
  "/admin/categories",
];

const MANAGER_ALLOWED_PAGES = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/reviews",
];

const VERIFIED_ONLY_PAGES = [
  "/checkout",
];

async function getTokenPayload(req) {
  try {
    // فقط session اصلی
    const token = req.cookies.get("token")?.value;

    if (!token) {
      return null;
    }

    const { payload } = await jwtVerify(
      token,
      secret
    );

    // Session اصلی باید متعلق به کاربر تاییدشده باشد
    if (
      !payload?.id ||
      payload?.isPhoneVerified !== true
    ) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error(
      "PROXY JWT ERROR:",
      error
    );

    return null;
  }
}

export async function proxy(req) {
  const { pathname } = req.nextUrl;

  const isAdminPage =
    pathname.startsWith("/admin");

  const needsVerifiedCheck =
    VERIFIED_ONLY_PAGES.some(
      (page) =>
        pathname === page ||
        pathname.startsWith(`${page}/`)
    );

  // صفحات عمومی
  if (
    !isAdminPage &&
    !needsVerifiedCheck
  ) {
    return NextResponse.next();
  }

  const payload = await getTokenPayload(req);

  // ─────────────────────────────────────────────
  // Checkout
  // ─────────────────────────────────────────────

  if (needsVerifiedCheck) {
    if (!payload) {
      const loginUrl = new URL(
        "/login",
        req.url
      );

      loginUrl.searchParams.set(
        "redirect",
        pathname
      );

      return NextResponse.redirect(loginUrl);
    }

    if (
      payload.isPhoneVerified !== true
    ) {
      const verifyUrl = new URL(
        "/verify-phone",
        req.url
      );

      verifyUrl.searchParams.set(
        "redirect",
        pathname
      );

      return NextResponse.redirect(
        verifyUrl
      );
    }

    return NextResponse.next();
  }

  // ─────────────────────────────────────────────
  // Admin
  // ─────────────────────────────────────────────

  if (isAdminPage) {
    // بدون session اصلی
    if (!payload) {
      const loginUrl = new URL(
        "/login",
        req.url
      );

      loginUrl.searchParams.set(
        "redirect",
        pathname
      );

      return NextResponse.redirect(
        loginUrl
      );
    }

    // حتی اگر JWT معتبر باشد،
    // باید حتماً verified باشد.
    if (
      payload.isPhoneVerified !== true
    ) {
      const verifyUrl = new URL(
        "/verify-phone",
        req.url
      );

      verifyUrl.searchParams.set(
        "redirect",
        pathname
      );

      return NextResponse.redirect(
        verifyUrl
      );
    }

    const role = payload.role;

    // فقط ADMIN و MANAGER
    if (
      !["ADMIN", "MANAGER"].includes(role)
    ) {
      return NextResponse.redirect(
        new URL("/403", req.url)
      );
    }

    // ───────────────────────────────────────────
    // فقط ADMIN
    // ───────────────────────────────────────────

    const isAdminOnlyPage =
      ADMIN_ONLY_PAGES.some(
        (page) =>
          pathname === page ||
          pathname.startsWith(`${page}/`)
      );

    if (
      isAdminOnlyPage &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(
        new URL("/403", req.url)
      );
    }

    // ───────────────────────────────────────────
    // محدودیت MANAGER
    // ───────────────────────────────────────────

    if (role === "MANAGER") {
      const isAllowed =
        MANAGER_ALLOWED_PAGES.some(
          (page) =>
            pathname === page ||
            pathname.startsWith(`${page}/`)
        );

      if (!isAllowed) {
        return NextResponse.redirect(
          new URL("/403", req.url)
        );
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/checkout/:path*",
  ],
};