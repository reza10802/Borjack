
import { NextResponse } from "next/server";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  expires: new Date(0),
  maxAge: 0,
  path: "/",
};

const LOGIN_CHALLENGE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  expires: new Date(0),
  maxAge: 0,
  path: "/api/auth/",
};

export async function POST() {
  const response = NextResponse.json(
    { success: true },
    {
      headers: {
        "Cache-Control": "no-store, private",
      },
    }
  );

  // نشست اصلی
  response.cookies.set("token", "", COOKIE_OPTIONS);

  // پاک‌سازی کوکی‌های قدیمی
  response.cookies.set("accessToken", "", COOKIE_OPTIONS);
  response.cookies.set("auth-token", "", COOKIE_OPTIONS);

  // توکن موقت تأیید شماره
  response.cookies.set(
    "phoneVerificationToken",
    "",
    COOKIE_OPTIONS
  );

  // توکن موقت تأیید ورود با OTP
  response.cookies.set(
    "loginVerificationToken",
    "",
    LOGIN_CHALLENGE_COOKIE_OPTIONS
  );

  return response;
}
