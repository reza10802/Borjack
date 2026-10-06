import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validations/auth";
import { sendOtpSms } from "@/lib/sms";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

const OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000;
const OTP_EXPIRES_MS = 2 * 60 * 1000;

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    // auth.js شماره را به فرمت 09xxxxxxxxx نرمال می‌کند
    const { phone, purpose } = parsed.data;

    // ─────────────────────────────────────────────
    // بررسی کاربر
    // ─────────────────────────────────────────────

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "کاربری با این شماره موبایل پیدا نشد.",
        },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "حساب کاربری شما مسدود شده است.",
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────
    // VERIFY PHONE
    // ─────────────────────────────────────────────

    if (purpose === "VERIFY_PHONE") {
      if (user.isPhoneVerified) {
        return NextResponse.json(
          {
            error: "شماره موبایل شما قبلاً تایید شده است.",
          },
          { status: 400 }
        );
      }

      const cookieStore = await cookies();

      const pendingToken = cookieStore.get(
        "phoneVerificationToken"
      )?.value;

      if (!pendingToken) {
        return NextResponse.json(
          {
            error:
              "جلسه تایید شماره منقضی شده است. دوباره وارد شوید.",
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
              "جلسه تایید شماره منقضی شده است. دوباره وارد شوید.",
          },
          { status: 401 }
        );
      }

      if (
        pendingPayload?.purpose !==
          "PHONE_VERIFICATION_PENDING" ||
        pendingPayload?.id !== user.id ||
        pendingPayload?.phone !== user.phone
      ) {
        return NextResponse.json(
          {
            error: "جلسه تایید شماره معتبر نیست.",
          },
          { status: 403 }
        );
      }
    }

    // ─────────────────────────────────────────────
    // COOLDOWN
    // ─────────────────────────────────────────────

    const lastOtp = await prisma.otpCode.findFirst({
      where: {
        phone,
        purpose,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() <
        OTP_RESEND_COOLDOWN_MS
    ) {
      const remainingSeconds = Math.ceil(
        (OTP_RESEND_COOLDOWN_MS -
          (Date.now() - lastOtp.createdAt.getTime())) /
          1000
      );

      return NextResponse.json(
        {
          error: `لطفاً ${remainingSeconds} ثانیه صبر کنید و دوباره تلاش کنید.`,
        },
        { status: 429 }
      );
    }

    // ─────────────────────────────────────────────
    // CREATE SECURE OTP
    // ─────────────────────────────────────────────

    const code = randomInt(100000, 1000000).toString();

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRES_MS
    );

    // فعلاً OTP جدید ساخته می‌شود.
    // اگر SMS شکست بخورد، همین رکورد حذف می‌شود
    // تا cooldown بی‌دلیل ایجاد نشود.
    const newOtp = await prisma.otpCode.create({
      data: {
        phone,
        code,
        purpose,
        expiresAt,
      },
    });

    // ─────────────────────────────────────────────
    // SEND SMS
    // ─────────────────────────────────────────────

    try {
      await sendOtpSms(phone, code, purpose);
    } catch (smsError) {
      console.error("SMS SEND ERROR:", smsError);

      // OTP ایجادشده بی‌اعتبار و حذف شود
      await prisma.otpCode.delete({
        where: {
          id: newOtp.id,
        },
      });

      throw smsError;
    }

    // ─────────────────────────────────────────────
    // فقط بعد از موفقیت ارسال SMS،
    // OTPهای قبلی همین purpose باطل شوند.
    // ─────────────────────────────────────────────

    await prisma.otpCode.updateMany({
      where: {
        phone,
        purpose,
        used: false,
        id: {
          not: newOtp.id,
        },
      },
      data: {
        used: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "کد تایید ارسال شد.",
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return NextResponse.json(
      {
        error:
          error?.message ||
          "خطا در ارسال کد تایید.",
      },
      { status: 500 }
    );
  }
}