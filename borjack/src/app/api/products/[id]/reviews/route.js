// src/app/api/products/[id]/reviews/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getSession } from "../../../../../lib/auth";

// POST — ثبت نظر جدید
export async function POST(req, { params }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

    const { id } = await params;
    const { rating, comment } = await req.json();

    if (!rating || !comment?.trim()) {
        return NextResponse.json({ error: "امتیاز و نظر الزامی است" }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
        return NextResponse.json({ error: "امتیاز باید بین ۱ تا ۵ باشد" }, { status: 400 });
    }

    const review = await prisma.review.create({
        data: {
            user: session.name,
            userId: session.id,
            rating,
            comment: comment.trim(),
            date: new Date().toLocaleDateString("fa-IR"),
            approved: false,
            productId: Number(id),
        },
    });

    return NextResponse.json({ review, message: "ممنون از نظرت! بعد از تایید نمایش داده میشه." }, { status: 201 });
}