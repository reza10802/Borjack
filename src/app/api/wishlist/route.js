
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// دریافت علاقه‌مندی‌های کاربر
export async function GET(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const wishlist = await prisma.wishlistItem.findMany({
      where: {
        userId: user.id,
        product: {
          is: {
            deletedAt: null,
          },
        },
      },
      include: {
        product: {
          include: {
            images: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(wishlist);
  } catch (error) {
    console.error("WISHLIST GET ERROR:", error);

    return NextResponse.json(
      { error: "خطا در دریافت علاقه‌مندی‌ها" },
      { status: 500 },
    );
  }
}

// افزودن محصول به علاقه‌مندی‌ها
export async function POST(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const productId = Number(body?.productId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // بررسی وجود محصول و آرشیونشدن آن
      const product = await tx.product.findFirst({
        where: {
          id: productId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!product) {
        return {
          type: "NOT_FOUND",
        };
      }

      // بررسی علاقه‌مندی تکراری
      const existing = await tx.wishlistItem.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId,
          },
        },
      });

      if (existing) {
        return {
          type: "EXISTS",
          item: existing,
        };
      }

      const item = await tx.wishlistItem.create({
        data: {
          userId: user.id,
          productId,
        },
      });

      return {
        type: "CREATED",
        item,
      };
    });

    if (result.type === "NOT_FOUND") {
      return NextResponse.json(
        { error: "این محصول دیگر در دسترس نیست" },
        { status: 404 },
      );
    }

    if (result.type === "EXISTS") {
      return NextResponse.json(
        { message: "این محصول قبلاً به علاقه‌مندی‌ها اضافه شده" },
        { status: 200 },
      );
    }

    return NextResponse.json(result.item, { status: 201 });
  } catch (error) {
    console.error("WISHLIST POST ERROR:", error);

    return NextResponse.json(
      { error: "خطا در افزودن به علاقه‌مندی‌ها" },
      { status: 500 },
    );
  }
}
