import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";
import { verifyOtpSchema } from "@/lib/validations/auth";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const MAX_OTP_ATTEMPTS = 5;

const INVALID_OTP_MESSAGE =
  "کد تأیید اشتباه یا منقضی شده است.";

const MAX_ATTEMPTS_MESSAGE =
  "تعداد تلاش‌های مجاز تمام شده است. لطفاً کد جدید درخواست کنید.";

function invalidOtpResponse() {
  return NextResponse.json(
    { error: INVALID_OTP_MESSAGE },
    { status: 400 }
  );
}

function maxAttemptsResponse() {
  return NextResponse.json(
    { error: MAX_ATTEMPTS_MESSAGE },
    { status: 429 }
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message ||
        "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { phone, code, purpose } = parsed.data;

    // این endpoint فقط برای تأیید شماره موبایل است.
    if (purpose !== "VERIFY_PHONE") {
      return NextResponse.json(
        { error: "نوع درخواست نامعتبر است." },
        { status: 400 }
      );
    }

    // بررسی توکن موقت تأیید شماره
    const cookieStore = await cookies();

    const pendingToken = cookieStore.get(
      "phoneVerificationToken"
    )?.value;

    if (!pendingToken) {
      return NextResponse.json(
        {
          error:
            "جلسه تأیید شماره منقضی شده است. دوباره وارد شوید.",
        },
        { status: 401 }
      );
    }

    let pendingPayload;

    try {
      pendingPayload = jwt.verify(
        pendingToken,
        JWT_SECRET
      );
    } catch {
      return NextResponse.json(
        {
          error:
            "جلسه تأیید شماره منقضی شده است. دوباره وارد شوید.",
        },
        { status: 401 }
      );
    }

    if (
      pendingPayload?.purpose !==
        "PHONE_VERIFICATION_PENDING" ||
      pendingPayload?.phone !== phone ||
      !pendingPayload?.id
    ) {
      return NextResponse.json(
        { error: "جلسه تأیید شماره معتبر نیست." },
        { status: 403 }
      );
    }

    // بررسی وضعیت کاربر
    const user = await prisma.user.findUnique({
      where: {
        id: pendingPayload.id,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "کاربر پیدا نشد." },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            "حساب کاربری شما توسط مدیریت غیرفعال شده است.",
        },
        { status: 403 }
      );
    }

    if (user.phone !== phone) {
      return NextResponse.json(
        {
          error:
            "شماره موبایل با حساب کاربری مطابقت ندارد.",
        },
        { status: 403 }
      );
    }

    if (user.isPhoneVerified) {
      return NextResponse.json(
        {
          error:
            "شماره موبایل شما قبلاً تأیید شده است.",
        },
        { status: 400 }
      );
    }

    // آخرین OTP این شماره را پیدا می‌کنیم؛
    // فیلتر کردن بر اساس code باعث می‌شد کد اشتباه شمرده نشود.
    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: "VERIFY_PHONE",
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
    });

    if (!otp) {
      return invalidOtpResponse();
    }

    // سقف تلاش‌ها حتی در درخواست‌های بعدی هم اعمال می‌شود.
    if (otp.failedAttempts >= MAX_OTP_ATTEMPTS) {
      await prisma.otpCode.updateMany({
        where: {
          id: otp.id,
          used: false,
        },
        data: {
          used: true,
        },
      });

      return maxAttemptsResponse();
    }

    if (otp.used) {
      return invalidOtpResponse();
    }

    const now = new Date();

    if (otp.expiresAt.getTime() <= now.getTime()) {
      await prisma.otpCode.updateMany({
        where: {
          id: otp.id,
          used: false,
        },
        data: {
          used: true,
        },
      });

      return invalidOtpResponse();
    }

    // کد اشتباه: افزایش اتمیک شمارنده با شرط‌های حفاظتی
    if (otp.code !== code) {
      const incrementResult = await prisma.otpCode.updateMany({
        where: {
          id: otp.id,
          phone,
          purpose: "VERIFY_PHONE",
          used: false,
          expiresAt: {
            gt: now,
          },
          failedAttempts: {
            lt: MAX_OTP_ATTEMPTS,
          },
        },
        data: {
          failedAttempts: {
            increment: 1,
          },
        },
      });

      // ممکن است درخواست هم‌زمان وضعیت OTP را تغییر داده باشد.
      const latestOtp = await prisma.otpCode.findUnique({
        where: {
          id: otp.id,
        },
        select: {
          used: true,
          failedAttempts: true,
        },
      });

      if (
        latestOtp &&
        latestOtp.failedAttempts >= MAX_OTP_ATTEMPTS
      ) {
        await prisma.otpCode.updateMany({
          where: {
            id: otp.id,
            used: false,
            failedAttempts: {
              gte: MAX_OTP_ATTEMPTS,
            },
          },
          data: {
            used: true,
          },
        });

        return maxAttemptsResponse();
      }

      if (incrementResult.count !== 1) {
        return invalidOtpResponse();
      }

      return invalidOtpResponse();
    }

    // کد صحیح: مصرف OTP و تأیید کاربر در یک تراکنش
    const updatedUser = await prisma.$transaction(
      async (tx) => {
        // فقط یک درخواست می‌تواند OTP را از حالت unused خارج کند.
        const claim = await tx.otpCode.updateMany({
          where: {
            id: otp.id,
            phone,
            code,
            purpose: "VERIFY_PHONE",
            used: false,
            expiresAt: {
              gt: new Date(),
            },
            failedAttempts: {
              lt: MAX_OTP_ATTEMPTS,
            },
          },
          data: {
            used: true,
          },
        });

        if (claim.count !== 1) {
          const currentOtp = await tx.otpCode.findUnique({
            where: {
              id: otp.id,
            },
            select: {
              failedAttempts: true,
            },
          });

          if (
            currentOtp &&
            currentOtp.failedAttempts >= MAX_OTP_ATTEMPTS
          ) {
            throw new Error("OTP_MAX_ATTEMPTS");
          }

          throw new Error("OTP_INVALID");
        }

        const updated = await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            isPhoneVerified: true,
            phoneVerifiedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
          },
        });

        // باطل کردن سایر کدهای استفاده‌نشده این شماره
        await tx.otpCode.updateMany({
          where: {
            phone,
            purpose: "VERIFY_PHONE",
            used: false,
            id: {
              not: otp.id,
            },
          },
          data: {
            used: true,
          },
        });

        return updated;
      }
    );

    // ساخت نشست اصلی فقط بعد از تأیید موفق
    const token = jwt.sign(
      {
        id: updatedUser.id,
        role: updatedUser.role,
        isPhoneVerified: true,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const response = NextResponse.json({
      success: true,
      purpose: "VERIFY_PHONE",
      message: "شماره موبایل با موفقیت تأیید شد.",
      user: updatedUser,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    // حذف نشست موقت تأیید شماره
    response.cookies.set(
      "phoneVerificationToken",
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    if (error?.message === "OTP_MAX_ATTEMPTS") {
      return maxAttemptsResponse();
    }

    if (error?.message === "OTP_INVALID") {
      return invalidOtpResponse();
    }

    console.error("VERIFY OTP ERROR:", error);

    return NextResponse.json(
      { error: "خطا در تأیید کد." },
      { status: 500 }
    );
  }
}