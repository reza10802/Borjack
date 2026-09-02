import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { sendOtpSms } from "@/lib/sms";

const iranPhoneRegex = /^09\d{9}$/;

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),
});

const COOLDOWN_MS = 2 * 60 * 1000;
const OTP_EXPIRES_MS = 2 * 60 * 1000;

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message,
        },
        { status: 400 }
      );
    }

    const { phone } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { phone },
      select: {
        id: true,
        isActive: true,
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

    const lastOtp = await prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: "RESET_PASSWORD",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() < COOLDOWN_MS
    ) {
      return NextResponse.json(
        {
          error: "لطفاً کمی صبر کنید و دوباره تلاش کنید.",
        },
        { status: 429 }
      );
    }

    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRES_MS
    );

    await prisma.otpCode.updateMany({
      where: {
        phone,
        purpose: "RESET_PASSWORD",
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
        purpose: "RESET_PASSWORD",
        expiresAt,
      },
    });

    await sendOtpSms(phone, code, "RESET_PASSWORD");

    return NextResponse.json({
      success: true,
      message: "کد بازیابی رمز عبور ارسال شد.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return NextResponse.json(
      {
        error: "خطا در ارسال کد بازیابی.",
      },
      { status: 500 }
    );
  }
}