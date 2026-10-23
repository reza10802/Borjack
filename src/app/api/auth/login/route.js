import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema } from "@/lib/validations/auth";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

const PENDING_VERIFICATION_MAX_AGE = 10 * 60;

const MAX_LOGIN_FAILURES = 10;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LOCKOUT_MINUTES = 15;

// برای نزدیک‌تر شدن زمان پاسخ شماره‌های ثبت‌نشده
// به زمان پاسخ شماره‌های موجود، رمز ساختگی را هم بررسی می‌کنیم.
const DUMMY_PASSWORD_HASH = bcrypt.hash(
  "borjak-invalid-account-password",
  10
);
const LOGIN_ATTEMPT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
const LOGIN_ATTEMPT_RETENTION_MS = 60 * 60 * 1000;

let lastLoginAttemptCleanupAt = 0;
let loginAttemptCleanupPromise = null;

async function cleanupStaleLoginAttempts() {
  const now = Date.now();

  if (
    now - lastLoginAttemptCleanupAt <
    LOGIN_ATTEMPT_CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  if (loginAttemptCleanupPromise) {
    return loginAttemptCleanupPromise;
  }

  loginAttemptCleanupPromise = (async () => {
    try {
      await prisma.loginAttempt.deleteMany({
        where: {
          updatedAt: {
            lt: new Date(Date.now() - LOGIN_ATTEMPT_RETENTION_MS),
          },
        },
      });
    } catch (error) {
      console.error("LOGIN ATTEMPT CLEANUP ERROR:", error);
    } finally {
      lastLoginAttemptCleanupAt = Date.now();
      loginAttemptCleanupPromise = null;
    }
  })();

  return loginAttemptCleanupPromise;
}

function getPhoneKey(phone) {
  return createHmac("sha256", JWT_SECRET)
    .update(`borjak:login-attempt:v1:${phone}`)
    .digest("hex");
}

function tooManyAttemptsResponse(blockedUntil) {
  const retryAfter = Math.max(
    1,
    Math.ceil((blockedUntil.getTime() - Date.now()) / 1000)
  );

  return NextResponse.json(
    {
      error:
        "تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

async function getActiveBlock(phoneKey) {
  const attempt = await prisma.loginAttempt.findUnique({
    where: { phoneKey },
    select: { blockedUntil: true },
  });

  if (attempt?.blockedUntil && attempt.blockedUntil > new Date()) {
    return attempt.blockedUntil;
  }

  return null;
}

async function recordFailedAttempt(phoneKey) {
  // افزایش شمارنده در یک دستور اتمیک PostgreSQL انجام می‌شود
  // تا درخواست‌های هم‌زمان شمارنده را از دست ندهند.
  const rows = await prisma.$queryRaw`
    INSERT INTO "LoginAttempt" (
      "phoneKey",
      "failedAttempts",
      "windowStartedAt",
      "blockedUntil",
      "updatedAt"
    )
    VALUES (
      ${phoneKey},
      1,
      NOW(),
      NULL,
      NOW()
    )
    ON CONFLICT ("phoneKey") DO UPDATE
    SET
      "failedAttempts" = CASE
        WHEN
          "LoginAttempt"."blockedUntil" IS NOT NULL
          AND "LoginAttempt"."blockedUntil" > NOW()
        THEN "LoginAttempt"."failedAttempts"

        WHEN
          "LoginAttempt"."windowStartedAt"
            <= NOW() - (${LOGIN_WINDOW_MINUTES} * INTERVAL '1 minute')
        THEN 1

        WHEN
          "LoginAttempt"."failedAttempts" + 1 >= ${MAX_LOGIN_FAILURES}
        THEN ${MAX_LOGIN_FAILURES}

        ELSE "LoginAttempt"."failedAttempts" + 1
      END,

      "windowStartedAt" = CASE
        WHEN
          "LoginAttempt"."blockedUntil" IS NOT NULL
          AND "LoginAttempt"."blockedUntil" > NOW()
        THEN "LoginAttempt"."windowStartedAt"

        WHEN
          "LoginAttempt"."windowStartedAt"
            <= NOW() - (${LOGIN_WINDOW_MINUTES} * INTERVAL '1 minute')
        THEN NOW()

        WHEN
          "LoginAttempt"."failedAttempts" + 1 >= ${MAX_LOGIN_FAILURES}
        THEN NOW()

        ELSE "LoginAttempt"."windowStartedAt"
      END,

      "blockedUntil" = CASE
        WHEN
          "LoginAttempt"."blockedUntil" IS NOT NULL
          AND "LoginAttempt"."blockedUntil" > NOW()
        THEN "LoginAttempt"."blockedUntil"

        WHEN
          "LoginAttempt"."windowStartedAt"
            <= NOW() - (${LOGIN_WINDOW_MINUTES} * INTERVAL '1 minute')
        THEN NULL

        WHEN
          "LoginAttempt"."failedAttempts" + 1 >= ${MAX_LOGIN_FAILURES}
        THEN NOW() + (${LOGIN_LOCKOUT_MINUTES} * INTERVAL '1 minute')

        ELSE NULL
      END,

      "updatedAt" = NOW()

    RETURNING "failedAttempts", "blockedUntil"
  `;

  return rows[0];
}

async function handleFailedLogin(phoneKey) {
  const attempt = await recordFailedAttempt(phoneKey);

  if (attempt?.blockedUntil && attempt.blockedUntil > new Date()) {
    return tooManyAttemptsResponse(attempt.blockedUntil);
  }

  return NextResponse.json(
    {
      error: "شماره موبایل یا رمز عبور اشتباه است",
    },
    { status: 401 }
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { phone, password } = parsed.data;
    const phoneKey = getPhoneKey(phone);
    await cleanupStaleLoginAttempts();

    // قبل از جست‌وجوی کاربر، محدودیت شماره را بررسی می‌کنیم.
    const blockedUntil = await getActiveBlock(phoneKey);

    if (blockedUntil) {
      return tooManyAttemptsResponse(blockedUntil);
    }

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    // برای شماره ثبت‌نشده هم مقایسه رمز انجام می‌شود.
    const passwordHash = user
      ? user.password
      : await DUMMY_PASSWORD_HASH;

    const isValid = await bcrypt.compare(password, passwordHash);

    if (!user || !isValid) {
      return await  handleFailedLogin(phoneKey);
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "حساب کاربری شما توسط مدیریت غیرفعال شده است.",
        },
        { status: 403 }
      );
    }

    // اعتبارسنجی موفق بوده؛ شمارنده قبلی حذف شود.
    await prisma.loginAttempt.deleteMany({
      where: { phoneKey },
    });

    // کاربر هنوز شماره موبایل را تأیید نکرده است.
    if (!user.isPhoneVerified) {
      const pendingToken = jwt.sign(
        {
          id: user.id,
          phone: user.phone,
          purpose: "PHONE_VERIFICATION_PENDING",
        },
        JWT_SECRET,
        {
          expiresIn: "10m",
        }
      );

      const response = NextResponse.json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isPhoneVerified: false,
        requiresPhoneVerification: true,
      });

      response.cookies.set(
        "phoneVerificationToken",
        pendingToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: PENDING_VERIFICATION_MAX_AGE,
          path: "/",
        }
      );

      return response;
    }

    // کاربر تأیید شده؛ ایجاد نشست اصلی.
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        isPhoneVerified: true,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isPhoneVerified: true,
      requiresPhoneVerification: false,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    response.cookies.set("phoneVerificationToken", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      { error: "خطا در ورود" },
      { status: 500 }
    );
  }
}