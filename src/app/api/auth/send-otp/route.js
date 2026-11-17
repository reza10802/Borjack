import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validations/auth";
import { sendOtpSms } from "@/lib/sms";
import { issueOtp } from "@/lib/otp";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipBucketKey } from "@/lib/security";
import { verifyJwt } from "@/lib/session";

const GENERIC_RESET_OK = {
  success: true,
  message: "اگر این شماره در برجک ثبت شده باشد و محدودیت ارسال فعال نباشد، کد بازیابی ارسال می‌شود.",
};

const resetCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth/reset-password",
  maxAge: 0,
};

function jsonTooMany(retryAfter, message) {
  return NextResponse.json(
    { error: message || `لطفاً ${retryAfter} ثانیه صبر کنید و دوباره تلاش کنید.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

function resetResponse(data = {}) {
  const response = NextResponse.json({ ...GENERIC_RESET_OK, ...data });
  // Always clear the browser's prior reset step. Keep this header consistent
  // for unknown, cooldown-blocked and successful reset requests.
  response.cookies.set("passwordResetToken", "", resetCookieOptions);
  return response;
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" },
        { status: 400 },
      );
    }

    const { phone, purpose } = parsed.data;
    const ip = getClientIp(req.headers);
    if (purpose === "LOGIN") {
      // Resending a login OTP is allowed only after the password was accepted.
      // The cookie is short-lived and tied to this exact user + phone + session version.
      const pendingToken = (await cookies()).get("loginVerificationToken")?.value;
      let payload = null;
      try { payload = pendingToken ? verifyJwt(pendingToken) : null; } catch { payload = null; }
      if (!payload || payload.purpose !== "LOGIN_VERIFICATION_PENDING" || payload.phone !== phone) {
        return NextResponse.json({ error: "جلسه تأیید ورود منقضی شده است. دوباره وارد شوید." }, { status: 401 });
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, phone: true, isActive: true, isPhoneVerified: true, tokenVersion: true },
      });
      if (!user || user.phone !== phone || !user.isActive || !user.isPhoneVerified ||
          Number(payload.tv ?? 0) !== Number(user.tokenVersion ?? 0)) {
        return NextResponse.json({ error: "جلسه تأیید ورود معتبر نیست. دوباره وارد شوید." }, { status: 401 });
      }
    } else if (purpose === "VERIFY_PHONE") {
      const pendingToken = (await cookies()).get("phoneVerificationToken")?.value;
      let payload = null;
      try { payload = pendingToken ? verifyJwt(pendingToken) : null; } catch { payload = null; }
      if (!payload || payload.purpose !== "PHONE_VERIFICATION_PENDING" || payload.phone !== phone) {
        return NextResponse.json(
          { error: "جلسه تایید شماره منقضی شده است. دوباره وارد شوید." },
          { status: 401 },
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, phone: true, isActive: true, isPhoneVerified: true },
      });
      if (!user || user.phone !== phone || !user.isActive) {
        return NextResponse.json({ error: "جلسه تایید شماره معتبر نیست." }, { status: 403 });
      }
      if (user.isPhoneVerified) {
        return NextResponse.json({ error: "شماره موبایل شما قبلاً تایید شده است." }, { status: 400 });
      }
    } else {
      // Prevent account enumeration: unknown/inactive numbers receive the same
      // response, but do not create per-phone OTP state or trigger an SMS.
      const user = await prisma.user.findUnique({
        where: { phone },
        select: { id: true, isActive: true },
      });
      if (!user?.isActive) {
        const ipLimit = await consumeRateLimit(`otp:ip:${ipBucketKey(ip)}`, 20, 3600);
        if (!ipLimit.allowed) {
          return jsonTooMany(ipLimit.retryAfter, "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.");
        }
        return resetResponse();
      }
    }

    const result = await issueOtp({
      phone,
      purpose,
      ip,
      send: (code) => sendOtpSms(phone, code, purpose),
    });

    if (purpose === "RESET_PASSWORD") {
      // The reset response intentionally does not expose the phone's cooldown
      // state. The server enforces the 2-minute / 3-hour policy regardless.
      if (result.reason === "ip_limit") {
        return jsonTooMany(result.retryAfter, "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.");
      }
      if (!result.ok) {
        return resetResponse();
      }
      return resetResponse();
    }

    if (!result.ok) {
      if (result.status === 429) {
        return jsonTooMany(
          result.retryAfter,
          result.reason === "cooldown"
            ? undefined
            : result.reason === "phone_cooldown"
              ? "محدودیت ارسال کد فعال است. لطفاً پس از پایان زمان اعلام‌شده دوباره تلاش کنید."
              : "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.",
        );
      }
      return NextResponse.json(
        { error: "ارسال پیامک با خطا مواجه شد. چند دقیقه بعد دوباره تلاش کنید." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "کد تایید ارسال شد.",
      expiresInSeconds: result.expiresInSeconds,
      nextRequestInSeconds: result.nextRequestInSeconds,
    });
  } catch (error) {
    console.error("SEND_OTP_ERROR:", error?.name || "error");
    return NextResponse.json({ error: "خطای داخلی سرور" }, { status: 500 });
  }
}
