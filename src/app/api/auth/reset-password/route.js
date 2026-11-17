import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { strongPasswordSchema } from "@/lib/validations/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipBucketKey } from "@/lib/security";
import { verifyJwt } from "@/lib/session";
import {
  consumePasswordResetGrant,
  hasPasswordResetGrant,
} from "@/lib/password-reset";
import { resetOtpIssuanceState } from "@/lib/otp";

const schema = z.object({ password: strongPasswordSchema });
const COOKIE_NAME = "passwordResetToken";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth/reset-password",
};

async function readResetGrant() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    if (
      payload?.purpose !== "PASSWORD_RESET" ||
      typeof payload.id !== "string" ||
      typeof payload.phone !== "string" ||
      typeof payload.jti !== "string" ||
      !Number.isInteger(payload.tv)
    ) return null;
    return payload;
  } catch {
    return null;
  }
}

function clearResetCookie(response) {
  response.cookies.set(COOKIE_NAME, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return response;
}

// Allows the reset page to recover its second step after a refresh, without
// exposing the HttpOnly authorization token to JavaScript.
export async function GET(req) {
  try {
    const requestedPhone = new URL(req.url).searchParams.get("phone");
    const grant = await readResetGrant();
    if (!grant || !requestedPhone || requestedPhone !== grant.phone) {
      const response = clearResetCookie(NextResponse.json({ authorized: false }));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const [user, grantExists] = await Promise.all([
      prisma.user.findFirst({
        where: { id: grant.id, phone: grant.phone, isActive: true, tokenVersion: grant.tv },
        select: { id: true },
      }),
      hasPasswordResetGrant({ phone: grant.phone, grantId: grant.jti }),
    ]);

    if (!user || !grantExists) {
      const response = clearResetCookie(NextResponse.json({ authorized: false }));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    const response = NextResponse.json({ authorized: true });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("RESET_PASSWORD_STATUS_ERROR:", error?.name || "error");
    const response = NextResponse.json({ authorized: false }, { status: 500 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}

// Step two: the OTP was already verified. Only the HttpOnly, DB-backed,
// short-lived and single-use grant can authorize this password change.
export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "رمز عبور نامعتبر است." },
        { status: 400 },
      );
    }

    const lim = await consumeRateLimit(`reset:ip:${ipBucketKey(getClientIp(req.headers))}`, 20, 3600);
    if (!lim.allowed) {
      return NextResponse.json(
        { error: "تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(lim.retryAfter) } },
      );
    }

    const grant = await readResetGrant();
    if (!grant) {
      return clearResetCookie(NextResponse.json(
        { error: "مجوز تغییر رمز منقضی شده است. دوباره کد بازیابی درخواست کنید." },
        { status: 401 },
      ));
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
    const completed = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: {
          id: grant.id,
          phone: grant.phone,
          isActive: true,
          tokenVersion: grant.tv,
        },
        select: { id: true },
      });
      if (!user) return false;

      // Delete is atomic: only one concurrent POST can consume this grant.
      const consumed = await consumePasswordResetGrant({
        phone: grant.phone,
        grantId: grant.jti,
        tx,
      });
      if (!consumed) return false;

      const updated = await tx.user.updateMany({
        where: {
          id: grant.id,
          phone: grant.phone,
          isActive: true,
          tokenVersion: grant.tv,
        },
        data: {
          password: hashedPassword,
          passwordChangedAt: new Date(),
          tokenVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) return false;

      await tx.otpCode.updateMany({
        where: { phone: grant.phone, purpose: "RESET_PASSWORD", used: false },
        data: { used: true },
      });
      await resetOtpIssuanceState({
        phone: grant.phone,
        purpose: "RESET_PASSWORD",
        tx,
      });
      return true;
    });

    if (!completed) {
      return clearResetCookie(NextResponse.json(
        { error: "مجوز تغییر رمز معتبر نیست یا قبلاً استفاده شده است. دوباره کد بازیابی درخواست کنید." },
        { status: 401 },
      ));
    }

    const response = NextResponse.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر کرد. برای ورود دوباره اقدام کنید.",
    });
    return clearResetCookie(response);
  } catch (error) {
    console.error("RESET_PASSWORD_ERROR:", error?.name || "error");
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
