import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyOtpSchema } from "@/lib/validations/auth";
import { getSessionUser } from "@/lib/auth";
import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(req) {
  try {
    const authUser = await getSessionUser();

    if (!authUser) {
      return NextResponse.json(
        { error: "ابتدا وارد حساب شوید" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const parsed = verifyOtpSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { phone, code } = parsed.data;

    if (authUser.phone !== phone) {
      return NextResponse.json(
        { error: "این شماره متعلق به حساب فعلی نیست" },
        { status: 403 }
      );
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        used: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "کد تایید اشتباه است" },
        { status: 400 }
      );
    }

    if (otp.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "کد تایید منقضی شده است" },
        { status: 400 }
      );
    }

    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    await prisma.user.update({
      where: { id: authUser.id },
      data: {
        isPhoneVerified: true,
        phoneVerifiedAt: new Date(),
      },
    });

    const newToken = jwt.sign(
      {
        id: authUser.id,
        role: authUser.role,
        isPhoneVerified: true,
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    const response = NextResponse.json({
      success: true,
      message: "شماره موبایل با موفقیت تایید شد",
    });

    response.cookies.set("token", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("VERIFY OTP ERROR:", error);
    return NextResponse.json(
      { error: "خطا در تایید کد" },
      { status: 500 }
    );
  }
}