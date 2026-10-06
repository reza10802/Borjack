import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { normalizeIranPhone } from "@/lib/validations/auth";

const normalizeOtpCode = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[۰-۹]/g, (char) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(char))
    )
    .replace(/[٠-٩]/g, (char) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(char))
    );

const schema = z.object({
  phone: z
    .string()
    .trim()
    .transform((value) => normalizeIranPhone(value))
    .refine(
      (value) =>
        typeof value === "string" &&
        /^09\d{9}$/.test(value),
      "شماره موبایل معتبر نیست"
    ),

  code: z
    .string()
    .trim()
    .transform(normalizeOtpCode)
    .refine(
      (value) => /^\d{6}$/.test(value),
      "کد تایید باید ۶ رقم باشد"
    ),

  password: z
    .string()
    .min(
      6,
      "رمز عبور باید حداقل ۶ کاراکتر باشد"
    )
    .max(
      100,
      "رمز عبور خیلی طولانی است"
    ),
});

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "اطلاعات نامعتبر است",
        },
        { status: 400 }
      );
    }

    const {
      phone,
      code,
      password,
    } = parsed.data;

    // ─────────────────────────────────────────────
    // بررسی کاربر
    // ─────────────────────────────────────────────

    const user = await prisma.user.findUnique({
      where: {
        phone,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error:
            "کاربری با این شماره موبایل پیدا نشد.",
        },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error:
            "حساب کاربری شما مسدود شده است.",
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────
    // پیدا کردن آخرین OTP
    // ─────────────────────────────────────────────

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
          error:
            "کد تایید اشتباه یا نامعتبر است.",
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // بررسی انقضا
    // ─────────────────────────────────────────────

    if (
      otp.expiresAt.getTime() <= Date.now()
    ) {
      await prisma.otpCode.updateMany({
        where: {
          id: otp.id,
          used: false,
        },
        data: {
          used: true,
        },
      });

      return NextResponse.json(
        {
          error:
            "کد تایید منقضی شده است.",
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // Hash password
    // ─────────────────────────────────────────────

    const hashedPassword =
      await bcrypt.hash(password, 10);

    // ─────────────────────────────────────────────
    // تغییر رمز + مصرف اتمیک OTP
    // ─────────────────────────────────────────────

    try {
      await prisma.$transaction(async (tx) => {
        const consumedOtp =
          await tx.otpCode.updateMany({
            where: {
              id: otp.id,
              used: false,
            },
            data: {
              used: true,
            },
          });

        if (consumedOtp.count !== 1) {
          throw new Error("OTP_ALREADY_USED");
        }

        await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            password: hashedPassword,
          },
        });

        // تمام OTPهای قدیمی‌تر بازیابی باطل شوند
        await tx.otpCode.updateMany({
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
        });
      });
    } catch (error) {
      if (error?.message === "OTP_ALREADY_USED") {
        return NextResponse.json(
          {
            error:
              "این کد قبلاً استفاده شده است.",
          },
          { status: 400 }
        );
      }

      throw error;
    }

    return NextResponse.json({
      success: true,
      message:
        "رمز عبور با موفقیت تغییر کرد.",
    });
  } catch (error) {
    console.error(
      "RESET PASSWORD ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "خطا در تغییر رمز عبور.",
      },
      { status: 500 }
    );
  }
}