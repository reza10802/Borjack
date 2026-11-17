
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
    requireAdmin,
    requireRoles,
    ROLES,
} from "@/lib/auth";

// GET: مشاهده دسته‌بندی‌ها برای ادمین و تأمین‌کننده
export async function GET() {
    const check = await requireRoles([
        ROLES.ADMIN,
        ROLES.SUPPLIER,
    ]);

    if (check.error) return check.error;

    try {
        const categories = await prisma.category.findMany({
            orderBy: { title: "asc" },
        });

        return NextResponse.json({ categories });
    } catch (error) {
        console.error("GET CATEGORIES ERROR:", error);

        return NextResponse.json(
            { error: "خطا در دریافت دسته‌بندی‌ها" },
            { status: 500 }
        );
    }
}

// POST: ایجاد دسته‌بندی فقط توسط ادمین
export async function POST(req) {
    const check = await requireAdmin(req);
    if (check.error) return check.error;

    try {
        const body = await req.json();
        const title =
            typeof body?.title === "string"
                ? body.title.trim()
                : "";

        if (!title) {
            return NextResponse.json(
                { error: "عنوان دسته‌بندی الزامی است" },
                { status: 400 }
            );
        }

        const existing = await prisma.category.findUnique({
            where: { title },
        });

        if (existing) {
            return NextResponse.json(
                { error: "این دسته‌بندی قبلاً ثبت شده" },
                { status: 409 }
            );
        }

        const category = await prisma.category.create({
            data: { title },
        });

        return NextResponse.json(
            { category },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE CATEGORY ERROR:", error);

        return NextResponse.json(
            { error: "خطا در ایجاد دسته‌بندی" },
            { status: 500 }
        );
    }
}

// DELETE: حذف دسته‌بندی فقط توسط ادمین
export async function DELETE(req) {
    const check = await requireAdmin(req);
    if (check.error) return check.error;

    try {
        const { searchParams } = new URL(req.url);
        const id = Number(searchParams.get("id"));

        if (!Number.isSafeInteger(id) || id <= 0) {
            return NextResponse.json(
                { error: "شناسه دسته‌بندی معتبر نیست" },
                { status: 400 }
            );
        }

        await prisma.category.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("DELETE CATEGORY ERROR:", error);

        return NextResponse.json(
            { error: "حذف دسته‌بندی انجام نشد" },
            { status: 500 }
        );
    }
}
