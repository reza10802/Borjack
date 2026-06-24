import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function POST(req) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "همه فیلدها الزامی هستند" },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user) {
      return NextResponse.json(
        { error: "این حساب وجود ندارد" },
        { status: 404 },
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "رمز عبور اشتباه است" },
        { status: 401 },
      );
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, identifier: user.identifier },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    const response = NextResponse.json({
      id: user.id,
      name: user.name,
      identifier: user.identifier,
    });

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در ورود" }, { status: 500 });
  }
}
