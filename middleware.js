// src/middleware.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

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

// صفحاتی که کاربر باید حتماً شماره‌اش رو تایید کرده باشه
const VERIFIED_ONLY_PAGES = ["/checkout"];

function getTokenPayload(req) {
  try {
    const token =
      req.cookies.get("token")?.value ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("auth-token")?.value;

    if (!token) return null;

    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  const needsVerifiedCheck = VERIFIED_ONLY_PAGES.some(
    (page) => pathname === page || pathname.startsWith(page + "/"),
  );

  if (!pathname.startsWith("/admin") && !needsVerifiedCheck) {
    return NextResponse.next();
  }

  const payload = getTokenPayload(req);
  const role = payload?.role || null;

  if (needsVerifiedCheck) {
    if (!payload) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    if (!payload.isPhoneVerified) {
      const verifyUrl = new URL("/verify-phone", req.url);
      verifyUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(verifyUrl);
    }
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // لاگین نیست
  if (!role) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // فقط ADMIN و MANAGER حق ورود به admin دارند
  if (!["ADMIN", "MANAGER"].includes(role)) {
    return NextResponse.redirect(new URL("/403", req.url));
  }

  // صفحات فقط مخصوص ADMIN
  if (ADMIN_ONLY_PAGES.some((page) => pathname === page || pathname.startsWith(page + "/"))) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", req.url));
    }
  }

  // اگر MANAGER خواست به صفحه‌ای خارج از محدوده خودش برود
  if (role === "MANAGER") {
    const allowed = MANAGER_ALLOWED_PAGES.some(
      (page) => pathname === page || pathname.startsWith(page + "/")
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