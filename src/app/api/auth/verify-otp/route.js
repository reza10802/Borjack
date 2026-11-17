import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyOtpSchema } from "@/lib/validations/auth";
import { resetOtpIssuanceState, verifyOtp } from "@/lib/otp";
import { createPasswordResetGrant } from "@/lib/password-reset";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipBucketKey, hmacHex } from "@/lib/security";
import { signSessionToken, sessionMaxAgeSeconds, verifyJwt } from "@/lib/session";
import { resetPhoneLoginFailures } from "@/lib/login-security";

const INVALID = "کد تأیید اشتباه یا منقضی شده است.";
const MAX_ATTEMPTS = "سه بار کد را اشتباه وارد کردید. این کد باطل شده است؛ کد جدید درخواست کنید.";
const cookieBase = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
    }
    const { phone, code, purpose } = parsed.data;

    const lim = await consumeRateLimit(`verify:ip:${ipBucketKey(getClientIp(req.headers))}`, 30, 600);
    if (!lim.allowed) {
      return NextResponse.json(
        { error: "تعداد تلاش‌ها زیاد است. کمی بعد دوباره تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(lim.retryAfter) } },
      );
    }

    if (purpose === "LOGIN") {
      // The pending token is only issued after the correct password was checked.
      // It is bound to the user, phone and tokenVersion so password changes revoke it.
      const pendingToken = (await cookies()).get("loginVerificationToken")?.value;
      let pending = null;
      try { pending = pendingToken ? verifyJwt(pendingToken) : null; } catch { pending = null; }
      if (!pending || pending.purpose !== "LOGIN_VERIFICATION_PENDING" || pending.phone !== phone) {
        return NextResponse.json({ error: "جلسه تأیید ورود منقضی شده است. دوباره وارد شوید." }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { id: pending.id },
        select: {
          id: true, name: true, phone: true, email: true, role: true,
          isPhoneVerified: true, isActive: true, tokenVersion: true,
        },
      });
      if (!user || user.phone !== phone || !user.isActive || !user.isPhoneVerified ||
          Number(pending.tv ?? 0) !== Number(user.tokenVersion ?? 0)) {
        return NextResponse.json({ error: "جلسه تأیید ورود معتبر نیست. دوباره وارد شوید." }, { status: 401 });
      }

      const verification = await prisma.$transaction(async (tx) => {
        const result = await verifyOtp({ phone, purpose: "LOGIN", code, tx });
        if (result.ok) {
          await resetPhoneLoginFailures(hmacHex(phone, "login"), tx);
          await resetOtpIssuanceState({ phone, purpose: "LOGIN", tx });
        }
        return result;
      });
      if (!verification.ok) {
        return verification.attemptsLeft === 0
          ? NextResponse.json({ error: MAX_ATTEMPTS }, { status: 429 })
          : NextResponse.json({ error: INVALID }, { status: 400 });
      }

      const response = NextResponse.json({
        success: true,
        purpose: "LOGIN",
        message: "ورود با موفقیت تأیید شد.",
        user: {
          id: user.id, name: user.name, phone: user.phone, email: user.email,
          role: user.role, isPhoneVerified: true,
        },
      });
      response.cookies.set("token", signSessionToken(user), {
        ...cookieBase,
        maxAge: sessionMaxAgeSeconds(user),
      });
      response.cookies.set("loginVerificationToken", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/",
        maxAge: 0,
      });
      response.cookies.set("phoneVerificationToken", "", { ...cookieBase, maxAge: 0 });
      return response;
    }

    if (purpose === "RESET_PASSWORD") {
      // Same public error for unknown/inactive accounts and invalid OTPs.
      const user = await prisma.user.findUnique({
        where: { phone },
        select: { id: true, phone: true, isActive: true, tokenVersion: true },
      });
      if (!user?.isActive) {
        return NextResponse.json({ error: INVALID }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const verification = await verifyOtp({ phone, purpose, code, tx });
        if (!verification.ok) return { verification };
        const resetToken = await createPasswordResetGrant({ user, tx });
        return { verification, resetToken };
      });

      if (!result.verification.ok) {
        // Keep the reset endpoint's response identical for unknown phones and
        // invalid codes; do not reveal whether a live OTP record exists.
        return NextResponse.json({ error: INVALID }, { status: 400 });
      }

      const response = NextResponse.json({
        success: true,
        purpose: "RESET_PASSWORD",
        nextStep: "SET_NEW_PASSWORD",
        message: "شماره موبایل تأیید شد. رمز عبور جدید خود را وارد کنید.",
      });
      response.cookies.set("passwordResetToken", result.resetToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/auth/reset-password",
        maxAge: 10 * 60,
      });
      return response;
    }

    // VERIFY_PHONE: requires the pending-verification session created by login.
    const pendingToken = (await cookies()).get("phoneVerificationToken")?.value;
    let pending = null;
    try { pending = pendingToken ? verifyJwt(pendingToken) : null; } catch { pending = null; }
    if (!pending || pending.purpose !== "PHONE_VERIFICATION_PENDING" || pending.phone !== phone) {
      return NextResponse.json({ error: "جلسه تایید شماره منقضی شده است. دوباره وارد شوید." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: pending.id } });
    if (!user || user.phone !== phone || !user.isActive) {
      return NextResponse.json({ error: "جلسه تایید شماره معتبر نیست." }, { status: 403 });
    }
    if (user.isPhoneVerified) {
      return NextResponse.json({ error: "شماره موبایل شما قبلاً تایید شده است." }, { status: 400 });
    }

    const registrationResult = await prisma.$transaction(async (tx) => {
      const verification = await verifyOtp({ phone, purpose: "VERIFY_PHONE", code, tx });
      if (!verification.ok) return { verification };

      const updated = await tx.user.update({
        where: { id: user.id },
        data: { isPhoneVerified: true, phoneVerifiedAt: new Date() },
        select: { id: true, name: true, phone: true, email: true, role: true, isPhoneVerified: true, tokenVersion: true },
      });
      await resetOtpIssuanceState({ phone, purpose: "VERIFY_PHONE", tx });
      return { verification, updatedUser: updated };
    });
    if (!registrationResult.verification.ok) {
      return registrationResult.verification.attemptsLeft === 0
        ? NextResponse.json({ error: MAX_ATTEMPTS }, { status: 429 })
        : NextResponse.json({ error: INVALID }, { status: 400 });
    }
    const updatedUser = registrationResult.updatedUser;
    const { tokenVersion, ...publicUser } = updatedUser;

    const response = NextResponse.json({
      success: true,
      purpose: "VERIFY_PHONE",
      message: "شماره موبایل با موفقیت تأیید شد.",
      user: publicUser,
    });
    response.cookies.set("token", signSessionToken(updatedUser), {
      ...cookieBase,
      maxAge: sessionMaxAgeSeconds(updatedUser),
    });
    response.cookies.set("phoneVerificationToken", "", { ...cookieBase, maxAge: 0 });
    return response;
  } catch (error) {
    console.error("VERIFY_OTP_ERROR:", error?.name || "error");
    return NextResponse.json({ error: "خطا در تأیید کد." }, { status: 500 });
  }
}
