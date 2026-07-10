import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin } from "@/lib/auth";

// آپدیت میانگین امتیاز و تعداد نظرات تاییدشده‌ی محصول
async function updateProductRating(productId) {
  const approvedReviews = await prisma.review.findMany({
    where: { productId, approved: true },
    select: { rating: true },
  });

  const reviewCount = approvedReviews.length;
  const avg =
    reviewCount > 0
      ? approvedReviews.reduce((sum, item) => sum + item.rating, 0) / reviewCount
      : 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: Math.round(avg * 10) / 10,
      reviewCount,
    },
  });
}

// GET /api/admin/reviews — لیست نظرات
export async function GET(req) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "pending"; // pending | approved | all

    const where =
      filter === "pending"
        ? { approved: false }
        : filter === "approved"
        ? { approved: true }
        : {};

    const reviews = await prisma.review.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const normalized = reviews.map((review) => ({
      ...review,
      date: review.createdAt,
    }));

    return NextResponse.json({ reviews: normalized });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت نظرات" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/reviews — تایید / عدم تایید نظر
export async function PATCH(req) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  try {
    const { reviewId, approved } = await req.json();

    if (typeof reviewId !== "number" || typeof approved !== "boolean") {
      return NextResponse.json(
        { error: "اطلاعات ارسالی نامعتبر است" },
        { status: 400 }
      );
    }

    const existing = await prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, productId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "نظر پیدا نشد" }, { status: 404 });
    }

    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { approved },
    });

    await updateProductRating(existing.productId);

    return NextResponse.json({ review });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در به‌روزرسانی نظر" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/reviews?id=... — حذف نظر (ADMIN + MANAGER)
export async function DELETE(req) {
  const check = await requireManagerOrAdmin();
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!id) {
      return NextResponse.json(
        { error: "شناسه نظر نامعتبر است" },
        { status: 400 }
      );
    }

    const review = await prisma.review.findUnique({
      where: { id },
      select: { id: true, productId: true },
    });

    if (!review) {
      return NextResponse.json({ error: "نظر پیدا نشد" }, { status: 404 });
    }

    await prisma.review.delete({
      where: { id },
    });

    await updateProductRating(review.productId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در حذف نظر" },
      { status: 500 }
    );
  }
}