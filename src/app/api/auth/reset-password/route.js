import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const iranPhoneRegex = /^09\d{9}$/;

const schema = z.object({
  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "کد تایید باید ۶ رقم باشد"),

  password: z
    .string()
    .min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد")
    .max(100, "رمز عبور خیلی طولانی است"),
});

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

    const { phone, code, password } = parsed.data;

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

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone,
        code,
        purpose: "RESET_PASSWORD",
        used: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!otp) {
      return NextResponse.json(
        {
          error: "کد تایید اشتباه است.",
        },
        { status: 400 }
      );
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      await prisma.otpCode.update({
        where: {
          id: otp.id,
        },
        data: {
          used: true,
        },
      });

      return NextResponse.json(
        {
          error: "کد تایید منقضی شده است.",
        },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          password: hashedPassword,
        },
      }),

      prisma.otpCode.update({
        where: {
          id: otp.id,
        },
        data: {
          used: true,
        },
      }),

      prisma.otpCode.updateMany({
        where: {
          phone,
          purpose: "RESET_PASSWORD",
          used: false,
          id: {
            not: otp.id,
          },
        },
        data: {
          used: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "رمز عبور با موفقیت تغییر کرد.",
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return NextResponse.json(
      {
        error: "خطا در تغییر رمز عبور.",
      },
      { status: 500 }
    );
  }
}