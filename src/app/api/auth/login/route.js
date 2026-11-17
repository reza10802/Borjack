import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { consumeRateLimit, peekRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipBucketKey, hmacHex } from "@/lib/security";
import { issueOtp } from "@/lib/otp";
import { sendOtpSms } from "@/lib/sms";
import { requiresLoginStepUp, recordPhoneLoginFailure, resetPhoneLoginFailures } from "@/lib/login-security";
import { signSessionToken, sessionMaxAgeSeconds } from "@/lib/session";
import { isTurnstileConfigured, verifyTurnstileToken } from "@/lib/turnstile";

const PENDING_VERIFICATION_MAX_AGE = 10 * 60;
const WINDOW = 15 * 60;
const MAX_FAIL_PAIR = 10;
const MAX_ATTEMPTS_IP = 60;
const LOGIN_CAPTCHA_THRESHOLD = 3;
const LOGIN_CHALLENGE_MAX_AGE = 10 * 60;
const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
const loginChallengeCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth/",
  maxAge: LOGIN_CHALLENGE_MAX_AGE,
};

// Equalise timing between unknown and known accounts.
const DUMMY_PASSWORD_HASH = bcrypt.hash("borjak-invalid-account-password", 10);

function tooMany(retryAfter, requiresCaptcha = false) {
  return NextResponse.json(
    {
      error: "تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.",
      ...(requiresCaptcha ? { requiresCaptcha: true } : {}),
    },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter || 60)) } },
  );
}

function captchaRequiredResponse(status = 428, message = "برای ادامه ورود، تأیید امنیتی را کامل کنید.", retryAfter = 0) {
  const headers = { "Cache-Control": "no-store" };
  if (retryAfter > 0) headers["Retry-After"] = String(Math.max(1, retryAfter));
  return NextResponse.json(
    { error: message, requiresCaptcha: true },
    { status, headers },
  );
}

async function hasActiveLoginOtp(phone) {
  const rows = await prisma.$queryRaw`
    SELECT "id" FROM "OtpCode"
    WHERE "phone" = ${phone}
      AND "purpose" = 'LOGIN'::"OtpPurpose"
      AND "used" = false
      AND "expiresAt" > NOW()
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;
  return rows.length > 0;
}

async function requireLoginChallenge({ user, ip }) {
  // Reuse an already-active challenge; do not invalidate a code or consume another SMS slot.
  const alreadyActive = await hasActiveLoginOtp(user.phone);
  const result = alreadyActive ? { ok: false, reason: "cooldown" } : await issueOtp({
    phone: user.phone,
    purpose: "LOGIN",
    ip,
    send: (code) => sendOtpSms(user.phone, code, "LOGIN"),
  });

  // A parallel/repeated password submission may hit cooldown while the first OTP is still valid.
  const reusable = alreadyActive || (!result.ok && result.reason === "cooldown" && await hasActiveLoginOtp(user.phone));
  if (!result.ok && !reusable) {
    if (result.reason === "ip_limit" || result.reason === "login_challenge_limit") {
      return { response: tooMany(result.retryAfter) };
    }
    return {
      response: NextResponse.json(
        { error: "ارسال کد تأیید ورود انجام نشد. کمی بعد دوباره تلاش کنید." },
        { status: 502 },
      )
    };
  }

  const token = jwt.sign(
    { id: user.id, phone: user.phone, tv: user.tokenVersion ?? 0, purpose: "LOGIN_VERIFICATION_PENDING" },
    process.env.JWT_SECRET,
    { algorithm: "HS256", expiresIn: "10m" },
  );
  const response = NextResponse.json({
    success: true,
    requiresLoginVerification: true,
    isPhoneVerified: true,
    message: "برای تکمیل ورود، کد تأیید پیامکی را وارد کنید.",
    expiresInSeconds: 120,
    nextRequestInSeconds: result.nextRequestInSeconds ?? 120,
  });
  response.cookies.set("loginVerificationToken", token, loginChallengeCookie);
  return { response };
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
    }

    const { phone, password, captchaToken } = parsed.data;
    const clientIp = getClientIp(req.headers);
    const ip = ipBucketKey(clientIp);
    const captchaKey = `login:captcha:${ip}`;
    const pairKey = `login:pair:${hmacHex(`${phone}|${ip}`, "login")}`;
    const phoneKey = hmacHex(phone, "login");

    // CAPTCHA is required only after three failed password attempts from this IP (/64).
    // A token is verified for this request only; Cloudflare tokens are single-use.
    const captchaState = await peekRateLimit(captchaKey, LOGIN_CAPTCHA_THRESHOLD, WINDOW);
    if (captchaState.blocked) {
      if (!captchaToken) return captchaRequiredResponse();
      if (!isTurnstileConfigured()) {
        return captchaRequiredResponse(503, "سرویس تأیید امنیتی هنوز روی سرور تنظیم نشده است.");
      }
      const captchaVerifyLimit = await consumeRateLimit(`login:captcha-verify:${ip}`, 20, WINDOW);
      if (!captchaVerifyLimit.allowed) {
        return captchaRequiredResponse(429, "تعداد تلاش‌های تأیید امنیتی زیاد است. کمی بعد دوباره تلاش کنید.", captchaVerifyLimit.retryAfter);
      }
      const verification = await verifyTurnstileToken({
        token: captchaToken,
        remoteIp: clientIp,
        expectedHostname: new URL(req.url).hostname,
      });
      if (!verification.ok) {
        if (verification.reason === "unavailable" || verification.reason === "not_configured" || verification.reason === "host_not_allowed") {
          return captchaRequiredResponse(503, "سرویس تأیید امنیتی در دسترس نیست. لطفاً کمی بعد تلاش کنید.");
        }
        return captchaRequiredResponse(403, "تأیید امنیتی معتبر نیست. لطفاً دوباره تلاش کنید.");
      }
    }

    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, name: true, phone: true, email: true, role: true, password: true, isPhoneVerified: true, isActive: true, tokenVersion: true },
    });
    const isValid = await bcrypt.compare(password, user ? user.password : await DUMMY_PASSWORD_HASH);

    if (!user || !isValid) {
      // These limits are charged only for failed passwords. A correct password is never rejected
      // merely because an attacker previously exhausted a phone-wide counter.
      const [ipLimit, pairLimit, captchaLimit] = await Promise.all([
        consumeRateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_IP, WINDOW),
        consumeRateLimit(pairKey, MAX_FAIL_PAIR, WINDOW),
        consumeRateLimit(captchaKey, LOGIN_CAPTCHA_THRESHOLD, WINDOW),
      ]);
      await recordPhoneLoginFailure(phoneKey);
      const requiresCaptcha = captchaLimit.count >= LOGIN_CAPTCHA_THRESHOLD;
      if (!ipLimit.allowed || !pairLimit.allowed) {
        return tooMany(
          Math.max(ipLimit.retryAfter || 0, pairLimit.retryAfter || 0),
          requiresCaptcha,
        );
      }
      return NextResponse.json(
        {
          error: "شماره موبایل یا رمز عبور اشتباه است.",
          ...(requiresCaptcha ? { requiresCaptcha: true } : {}),
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "حساب کاربری شما توسط مدیریت غیرفعال شده است." }, { status: 403 });
    }

    await resetRateLimit(pairKey);

    if (!user.isPhoneVerified) {
      await resetPhoneLoginFailures(phoneKey);
      const pendingToken = jwt.sign(
        { id: user.id, phone: user.phone, purpose: "PHONE_VERIFICATION_PENDING" },
        process.env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "10m" },
      );
      const response = NextResponse.json({
        id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role,
        isPhoneVerified: false, requiresPhoneVerification: true,
      });
      response.cookies.set("phoneVerificationToken", pendingToken, { ...cookieBase, maxAge: PENDING_VERIFICATION_MAX_AGE });
      return response;
    }

    if (await requiresLoginStepUp(phoneKey)) {
      const challenge = await requireLoginChallenge({ user, ip: clientIp });
      return challenge.response;
    }

    await resetPhoneLoginFailures(phoneKey);
    const response = NextResponse.json({
      id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role,
      isPhoneVerified: true, requiresPhoneVerification: false,
    });
    response.cookies.set("token", signSessionToken(user), { ...cookieBase, maxAge: sessionMaxAgeSeconds(user) });
    response.cookies.set("phoneVerificationToken", "", { ...cookieBase, maxAge: 0 });
    response.cookies.set("loginVerificationToken", "", { ...loginChallengeCookie, maxAge: 0 });
    return response;
  } catch (error) {
    console.error("LOGIN_ERROR_DETAILS:", {
      name: error?.name,
      code: error?.code,
      message: error?.message,
      meta: error?.meta,
      clientVersion: error?.clientVersion,
    });

    if (process.env.NODE_ENV !== "production") {
      console.error(error?.stack);
    }

    return NextResponse.json(
      { error: "خطا در ورود" },
      { status: 500 },
    );
  }
}
