import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import bcrypt from "bcryptjs";

export async function POST(req) {
    try {
        const { name, identifier, password } = await req.json();

        if (!name || !identifier || !password) {
            return NextResponse.json({ error: "همه فیلدها الزامی هستند" }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد" }, { status: 400 });
        }

        const existing = await prisma.user.findUnique({ where: { identifier } });
        if (existing) {
            return NextResponse.json({ error: "این حساب قبلاً ثبت شده" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { name, identifier, password: hashedPassword },
        });

        return NextResponse.json({
            id: user.id,
            name: user.name,
            identifier: user.identifier,
        }, { status: 201 });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در ثبت‌نام" }, { status: 500 });
    }
}