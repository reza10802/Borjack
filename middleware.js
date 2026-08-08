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

const VERIFIED_ONLY_PAGES = ["/checkout"];

async function getTokenPayload(req) {
  try {
    const token =
      req.cookies.get("token")?.value ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("auth-token")?.value;

    if (!token) return null;

    const { payload } = await jwtVerify(token, secret);

    return payload;
  } catch (error) {
    console.error("MIDDLEWARE JWT ERROR:", error);
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;



  const needsVerifiedCheck = VERIFIED_ONLY_PAGES.some(
    (page) => pathname === page || pathname.startsWith(page + "/")
  );

  if (!pathname.startsWith("/admin") && !needsVerifiedCheck) {
    return NextResponse.next();
  }

  const payload = await getTokenPayload(req);
  const role = payload?.role || null;

  console.log("=== MIDDLEWARE ===");
  console.log("PATH:", pathname);
  console.log("HAS TOKEN:", !!payload);
  console.log("USER ID:", payload?.id);
  console.log("ROLE:", role);
  console.log("PHONE VERIFIED:", payload?.isPhoneVerified);

  // Checkout
  if (needsVerifiedCheck) {
    if (!payload) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${pathname}`, req.url)
      );
    }

    if (!payload.isPhoneVerified) {
      const verifyUrl = new URL("/verify-phone", req.url);
      verifyUrl.searchParams.set("redirect", pathname);

      return NextResponse.redirect(verifyUrl);
    }
  }

  // سایر صفحات غیر ادمین
  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // لاگین نیست
  if (!role) {
    return NextResponse.redirect(
      new URL(`/login?redirect=${pathname}`, req.url)
    );
  }

  // فقط ADMIN و MANAGER
  if (!["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // فقط ADMIN
  if (
    ADMIN_ONLY_PAGES.some(
      (page) =>
        pathname === page || pathname.startsWith(page + "/")
    )
  ) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  // محدودیت MANAGER
  if (role === "MANAGER") {
    const allowed = MANAGER_ALLOWED_PAGES.some(
      (page) =>
        pathname === page || pathname.startsWith(page + "/")
    );

    if (!allowed) {
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/checkout/:path*"],
};