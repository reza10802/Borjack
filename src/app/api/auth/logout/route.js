// src/app/api/auth/logout/route.js

import { NextResponse } from "next/server";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  expires: new Date(0),
  maxAge: 0,
  path: "/",
};

export async function POST() {
  const response = NextResponse.json({
    success: true,
  });

  // JWT اصلی
  response.cookies.set("token", "", COOKIE_OPTIONS);

  // Cookieهای قدیمی/سازگاری
  response.cookies.set(
    "accessToken",
    "",
    COOKIE_OPTIONS
  );

  response.cookies.set(
    "auth-token",
    "",
    COOKIE_OPTIONS
  );

  // توکن موقت تایید شماره
  response.cookies.set(
    "phoneVerificationToken",
    "",
    COOKIE_OPTIONS
  );

  return response;
}