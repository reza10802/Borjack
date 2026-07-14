import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendOtpSchema } from "@/lib/validations/auth";

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
    // کد تستی
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

    // TODO: اینجا بعداً سرویس پیامک واقعی را صدا بزن
    // await smsProvider.send(phone, `کد تایید شما: ${code}`);

    return NextResponse.json({
      message: "کد تایید ارسال شد",
      // فقط برای محیط تست:
      code,
    });
  } catch (error) {
    console.error("SEND OTP ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ارسال کد تایید" },
      { status: 500 },
    );
  }
}
