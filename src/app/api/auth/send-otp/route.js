import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validations/auth";
import { sendOtpSms } from "@/lib/sms";

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
        { status: 400 },
      );
    }

    const { phone, purpose } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        phone: true,
        isActive: true,
        isPhoneVerified: true,
      },
    });

    // -------------------------
    // بررسی کاربر
    // -------------------------

    if (!user) {
      return NextResponse.json(
        { error: "کاربری با این شماره موبایل پیدا نشد." },
        { status: 404 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "حساب کاربری شما مسدود شده است." },
        { status: 403 },
      );
    }

    // -------------------------
    // VERIFY PHONE
    // -------------------------

    if (purpose === "VERIFY_PHONE") {
      if (user.isPhoneVerified) {
        return NextResponse.json(
          {
            error: "شماره موبایل شما قبلاً تایید شده است.",
          },
          { status: 400 },
        );
      }
    }

    // -------------------------
    // COOLDOWN
    // -------------------------

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
      return NextResponse.json(
        {
          error: "لطفاً کمی صبر کنید و دوباره تلاش کنید.",
        },
        { status: 429 },
      );
    }

    // -------------------------
    // CREATE OTP
    // -------------------------

    const code = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRES_MS,
    );

    // OTPهای قبلی همین purpose باطل شوند
    await prisma.otpCode.updateMany({
      where: {
        phone,
        purpose,
        used: false,
      },
      data: {
        used: true,
      },
    });

    await prisma.otpCode.create({
      data: {
        phone,
        code,
        purpose,
        expiresAt,
      },
    });

    // -------------------------
    // SEND SMS
    // -------------------------

    await sendOtpSms(phone, code, purpose);

    return NextResponse.json({
      success: true,
      message: "کد تایید ارسال شد.",
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);

    return NextResponse.json(
      {
        error: "خطا در ارسال کد تایید.",
      },
      { status: 500 },
    );
  }
}