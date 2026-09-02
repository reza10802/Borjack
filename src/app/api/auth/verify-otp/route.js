import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtpSchema } from "@/lib/validations/auth";

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 },
      );
    }

    const { phone, code, purpose } = parsed.data;

    // این endpoint فقط برای تایید شماره است
    if (purpose !== "VERIFY_PHONE") {
      return NextResponse.json(
        { error: "نوع درخواست نامعتبر است." },
        { status: 400 },
      );
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        purpose: "VERIFY_PHONE",
        used: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return NextResponse.json(
        {
          error: "کد تایید اشتباه یا منقضی شده است.",
        },
        { status: 400 },
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { used: true },
      });

      return NextResponse.json(
        {
          error: "کد تایید منقضی شده است.",
        },
        { status: 400 },
      );
    }

    // مصرف OTP
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    // تایید شماره
    await prisma.user.update({
      where: { phone },
      data: {
        isPhoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      purpose: "VERIFY_PHONE",
      message: "شماره موبایل با موفقیت تایید شد.",
    });
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);

    return NextResponse.json(
      {
        error: "خطا در تایید کد.",
      },
      { status: 500 },
    );
  }
}