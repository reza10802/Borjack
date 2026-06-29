// src/app/api/admin/reviews/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";

// GET — لیست نظرات در انتظار تایید
export async function GET(req) {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "pending"; // pending | approved | all

    const where = filter === "pending" ? { approved: false }
        : filter === "approved" ? { approved: true }
        : {};

    const reviews = await prisma.review.findMany({
        where,
        include: { product: { select: { id: true, title: true, image: true } } },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ reviews });
}

// PATCH — تایید یا رد نظر
export async function PATCH(req) {
    const { session, error } = await requireAdmin();
    if (error) return error;

    const { reviewId, approved } = await req.json();

    const review = await prisma.review.update({
        where: { id: reviewId },
        data: { approved },
    });

    // اگه تایید شد، میانگین ستاره محصول رو آپدیت کن
    if (approved) {
        const reviews = await prisma.review.findMany({
            where: { productId: review.productId, approved: true },
            select: { rating: true },
        });
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        await prisma.product.update({
            where: { id: review.productId },
            data: {
                rating: Math.round(avg * 10) / 10,
                reviewCount: reviews.length,
            },
        });
    }

    return NextResponse.json({ review });
}

// DELETE — حذف نظر
export async function DELETE(req) {
    const { error } = await requireAdmin();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    const review = await prisma.review.findUnique({ where: { id } });
    await prisma.review.delete({ where: { id } });

    // آپدیت میانگین بعد از حذف
    const reviews = await prisma.review.findMany({
        where: { productId: review.productId, approved: true },
        select: { rating: true },
    });
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
    await prisma.product.update({
        where: { id: review.productId },
        data: { rating: Math.round(avg * 10) / 10, reviewCount: reviews.length },
    });

    return NextResponse.json({ success: true });
}