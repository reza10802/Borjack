import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loginSchema } from "@/lib/validations/auth";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

const PENDING_VERIFICATION_MAX_AGE = 10 * 60;

export async function POST(req) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { phone, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      return NextResponse.json(
        { error: "این حساب وجود ندارد" },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "حساب کاربری شما توسط مدیریت غیرفعال شده است.",
        },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    // ─────────────────────────────────────────────
    // کاربر هنوز شماره موبایل را تأیید نکرده
    // فقط یک token موقت برای مرحله OTP می‌سازیم.
    // این token session اصلی نیست.
    // ─────────────────────────────────────────────

    if (!user.isPhoneVerified) {
      const pendingToken = jwt.sign(
        {
          id: user.id,
          phone: user.phone,
          purpose: "PHONE_VERIFICATION_PENDING",
        },
        JWT_SECRET,
        {
          expiresIn: "10m",
        }
      );

      const response = NextResponse.json({
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        isPhoneVerified: false,
        requiresPhoneVerification: true,
      });

      response.cookies.set(
        "phoneVerificationToken",
        pendingToken,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: PENDING_VERIFICATION_MAX_AGE,
          path: "/",
        }
      );

      return response;
    }

    // ─────────────────────────────────────────────
    // کاربر تأیید شده → session اصلی
    // ─────────────────────────────────────────────

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        isPhoneVerified: true,
      },
      JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isPhoneVerified: true,
      requiresPhoneVerification: false,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    // اگر قبلاً token موقت وجود داشته، پاک شود
    response.cookies.set(
      "phoneVerificationToken",
      "",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      }
    );

    return response;
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return NextResponse.json(
      { error: "خطا در ورود" },
      { status: 500 }
    );
  }
}