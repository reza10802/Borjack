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

function getRoleFromToken(req) {
  try {
    const token =
      req.cookies.get("token")?.value ||
      req.cookies.get("accessToken")?.value ||
      req.cookies.get("auth-token")?.value;

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.role || null;
  } catch {
    return null;
  }
}

export function middleware(req) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const role = getRoleFromToken(req);

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
  matcher: ["/admin/:path*"],
};