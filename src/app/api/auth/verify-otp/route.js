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

    // فقط تایید شماره
    if (purpose !== "VERIFY_PHONE") {
      return NextResponse.json(
        {
          error: "نوع درخواست نامعتبر است.",
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // بررسی token موقت
    // ─────────────────────────────────────────────

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

    // token موقت باید مخصوص تایید شماره باشد
    if (
      pendingPayload?.purpose !==
        "PHONE_VERIFICATION_PENDING" ||
      pendingPayload?.phone !== phone ||
      !pendingPayload?.id
    ) {
      return NextResponse.json(
        {
          error: "جلسه تایید شماره معتبر نیست.",
        },
        { status: 403 }
      );
    }

    // ─────────────────────────────────────────────
    // بررسی کاربر
    // ─────────────────────────────────────────────

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
        {
          error: "کاربر پیدا نشد.",
        },
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
            "شماره موبایل شما قبلاً تایید شده است.",
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // پیدا کردن OTP
    // ─────────────────────────────────────────────

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
          error:
            "کد تایید اشتباه یا منقضی شده است.",
        },
        { status: 400 }
      );
    }

    // ─────────────────────────────────────────────
    // بررسی انقضا
    // ─────────────────────────────────────────────

    if (otp.expiresAt.getTime() <= Date.now()) {
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

    // ─────────────────────────────────────────────
    // تایید اتمیک OTP + کاربر
    // ─────────────────────────────────────────────

    const updatedUser = await prisma.$transaction(
      async (tx) => {
        // دوباره OTP را بررسی می‌کنیم تا
        // درخواست همزمان نتواند همان OTP را مصرف کند.
        const currentOtp =
          await tx.otpCode.findUnique({
            where: {
              id: otp.id,
            },
          });

        if (
          !currentOtp ||
          currentOtp.used ||
          currentOtp.expiresAt.getTime() <=
            Date.now()
        ) {
          throw new Error("OTP_INVALID");
        }

        await tx.otpCode.update({
          where: {
            id: currentOtp.id,
          },
          data: {
            used: true,
          },
        });

        const updated =
          await tx.user.update({
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

        // تمام OTPهای باقی‌مانده تایید شماره باطل شوند
        await tx.otpCode.updateMany({
          where: {
            phone,
            purpose: "VERIFY_PHONE",
            used: false,
            id: {
              not: currentOtp.id,
            },
          },
          data: {
            used: true,
          },
        });

        return updated;
      }
    );

    // ─────────────────────────────────────────────
    // ساخت JWT اصلی
    // ─────────────────────────────────────────────

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
      message:
        "شماره موبایل با موفقیت تایید شد.",
      user: updatedUser,
    });

    // session اصلی
    response.cookies.set("token", token, {
      httpOnly: true,
      secure:
        process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    });

    // حذف token موقت
    response.cookies.set(
      "phoneVerificationToken",
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    if (error?.message === "OTP_INVALID") {
      return NextResponse.json(
        {
          error:
            "کد تایید اشتباه یا منقضی شده است.",
        },
        { status: 400 }
      );
    }

    console.error(
      "VERIFY OTP ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "خطا در تایید کد.",
      },
      { status: 500 }
    );
  }
}