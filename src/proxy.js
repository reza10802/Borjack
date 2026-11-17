// src/middleware.js

import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

const secret = new TextEncoder().encode(JWT_SECRET);

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
      secret,
      { algorithms: ["HS256"] }
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

  const isSupplierPage =
    pathname === "/supplier" ||
    pathname.startsWith("/supplier/");

  const needsVerifiedCheck =
    VERIFIED_ONLY_PAGES.some(
      (page) =>
        pathname === page ||
        pathname.startsWith(`${page}/`)
    );

  // صفحات عمومی
  if (
    !isAdminPage &&
    !isSupplierPage &&
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
  // Admin + Supplier panels
  // ─────────────────────────────────────────────

  if (isAdminPage || isSupplierPage) {
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

    // /admin is ADMIN-only and /supplier is SUPPLIER-only. The JWT role is just a page-shell
    // gate (it can be up to 8h stale); every API re-reads role/isActive/tokenVersion from the DB.
    const requiredRole = isSupplierPage ? "SUPPLIER" : "ADMIN";

    if (role !== requiredRole) {
      return NextResponse.redirect(
        new URL("/403", req.url)
      );
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/supplier/:path*",
    "/checkout/:path*",
  ],
};