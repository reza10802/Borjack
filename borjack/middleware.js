import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// مسیرهایی که فقط ADMIN یا MANAGER می‌توانند ببینند
const ADMIN_ROUTES = ["/admin"];

// مسیرهایی که فقط MANAGER می‌تواند ببیند
const MANAGER_ROUTES = ["/manager"];

// مسیرهایی که باید لاگین باشند (CUSTOMER+)
const AUTH_ROUTES = ["/cart", "/profile", "/checkout"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("token")?.value;

  // تابع کمکی برای redirect به صفحه login
  const redirectToLogin = () => {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  };

  // تابع کمکی برای صفحه 403
  const redirectToForbidden = () => {
    return NextResponse.redirect(new URL("/403", request.url));
  };

  // بررسی مسیرهای MANAGER
  if (MANAGER_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!token) return redirectToLogin();
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (payload.role !== "MANAGER") return redirectToForbidden();
    } catch {
      return redirectToLogin();
    }
  }

  // بررسی مسیرهای ADMIN (MANAGER هم مجاز است)
  else if (ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!token) return redirectToLogin();
    try {
      const { payload } = await jwtVerify(token, SECRET);
      if (!["ADMIN", "MANAGER"].includes(payload.role)) return redirectToForbidden();
    } catch {
      return redirectToLogin();
    }
  }

  // بررسی مسیرهای نیازمند لاگین
  else if (AUTH_ROUTES.some((r) => pathname.startsWith(r))) {
    if (!token) return redirectToLogin();
    try {
      await jwtVerify(token, SECRET);
    } catch {
      return redirectToLogin();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/manager/:path*",
    "/cart/:path*",
    "/profile/:path*",
    "/checkout/:path*",
  ],
};