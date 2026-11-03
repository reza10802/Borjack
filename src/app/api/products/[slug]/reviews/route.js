
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// POST /api/products/[slug]/reviews
export async function POST(req, { params }) {
  try {
    const session = await getSessionUser(req);

    if (!session) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const { slug } = await params;

    if (!slug || typeof slug !== "string") {
      return NextResponse.json(
        { error: "آدرس محصول معتبر نیست" },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);

    const rating = Number(body?.rating);
    const comment =
      typeof body?.comment === "string"
        ? body.comment.trim()
        : "";

    if (!comment || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: "امتیاز و متن نظر الزامی است" },
        { status: 400 },
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "امتیاز باید بین ۱ تا ۵ باشد" },
        { status: 400 },
      );
    }

    if (comment.length > 5000) {
      return NextResponse.json(
        { error: "متن نظر نمی‌تواند بیشتر از ۵۰۰۰ کاراکتر باشد" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findFirst({
          where: {
            slug,
            deletedAt: null,
            isPublished: true,
          },
          select: {
            id: true,
          },
        });

        if (!product) {
          return { type: "NOT_FOUND" };
        }

        const review = await tx.review.create({
          data: {
            user: session.name,
            userId: session.id,
            rating,
            comment,
            date: new Date().toLocaleDateString("fa-IR"),
            approved: false,
            productId: product.id,
          },
        });

        return {
          type: "CREATED",
          review,
        };
      },
      {
        isolationLevel: "Serializable",
      },
    );

    if (result.type === "NOT_FOUND") {
      return NextResponse.json(
        { error: "این محصول دیگر در دسترس نیست" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        review: result.review,
        message: "ممنون از نظرت! بعد از تأیید نمایش داده می‌شود.",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE PRODUCT REVIEW ERROR:", error);

    if (error?.code === "P2034") {
      return NextResponse.json(
        { error: "وضعیت محصول تغییر کرده است؛ لطفاً دوباره تلاش کنید." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ثبت نظر" },
      { status: 500 },
    );
  }
}
