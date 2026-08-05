import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validations/auth";
import { sendOtpSms } from "@/lib/sms";

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = sendOtpSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "شماره موبایل نامعتبر است";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { phone } = parsed.data;

    const user = await prisma.user.findUnique({
      where: {
        phone,
      },
    });

    if (user && !user.isActive) {
      return NextResponse.json(
        {
          error: "حساب کاربری شما مسدود شده است.",
        },
        {
          status: 403,
        },
      );
    }

    // محدودیت ارسال: حداقل ۶۰ ثانیه بین دو درخواست برای همان شماره
    const lastOtp = await prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (
      lastOtp &&
      Date.now() - lastOtp.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      return NextResponse.json(
        { error: "لطفاً کمی صبر کنید و دوباره تلاش کنید" },
        { status: 429 },
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // منقضی شدن 2 دقیقه‌ای
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // همه کدهای استفاده‌نشده قبلی را باطل می‌کنیم
    await prisma.otpCode.updateMany({
      where: {
        phone,
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
        expiresAt,
      },
    });

    const message = [
      "کد تایید فروشگاه:",
      code,
      "",
      "اعتبار: ۲ دقیقه",
    ].join("\n");

    if (process.env.NODE_ENV === "production") {
      await sendOtpSms(phone, code);
    } else {
      console.log(`[DEV ONLY] کد OTP برای ${phone}: ${code}`);
    }

    return NextResponse.json({
      success: true,
      message: "کد تایید ارسال شد",
      ...(process.env.NODE_ENV !== "production" ? { devCode: code } : {}),
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ارسال کد تایید" },
      { status: 500 },
    );
  }
}