import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json([], { status: 200 });
    }

    const wishlist = await prisma.wishlistItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(wishlist);
  } catch (error) {
    console.error("WISHLIST GET ERROR:", error);
    return NextResponse.json(
      { error: "خطا در دریافت علاقه‌مندی‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const body = await req.json();
    const productId = Number(body.productId);

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 }
      );
    }

    const exists = await prisma.wishlistItem.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });

    if (exists) {
      return NextResponse.json(
        { message: "این محصول قبلاً به علاقه‌مندی‌ها اضافه شده" },
        { status: 200 }
      );
    }

    const item = await prisma.wishlistItem.create({
      data: {
        userId: user.id,
        productId,
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("WISHLIST POST ERROR:", error);
    return NextResponse.json(
      { error: "خطا در افزودن به علاقه‌مندی‌ها" },
      { status: 500 }
    );
  }
}