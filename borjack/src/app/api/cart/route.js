import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// گرفتن آیتم‌های سبد خرید
export async function GET(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    return NextResponse.json(cartItems);
  } catch (error) {
    console.error("CART GET ERROR:", error);
    return NextResponse.json(
      { error: "خطا در دریافت سبد خرید" },
      { status: 500 }
    );
  }
}

// افزودن به سبد خرید
export async function POST(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const body = await req.json();
    const productId = Number(body.productId);
    const quantity = Number(body.quantity) || 1;

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 }
      );
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });

    let cartItem;

    if (existingItem) {
      cartItem = await prisma.cartItem.update({
        where: {
          userId_productId: {
            userId: user.id,
            productId,
          },
        },
        data: {
          quantity: existingItem.quantity + quantity,
        },
        include: {
          product: {
            include: {
              images: true,
            },
          },
        },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          userId: user.id,
          productId,
          quantity,
        },
        include: {
          product: {
            include: {
              images: true,
            },
          },
        },
      });
    }

    return NextResponse.json(cartItem, { status: 201 });
  } catch (error) {
    console.error("CART POST ERROR:", error);
    return NextResponse.json(
      { error: "خطا در افزودن به سبد خرید" },
      { status: 500 }
    );
  }
}

// حذف کل یک آیتم از سبد با productId
export async function DELETE(req) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = Number(searchParams.get("productId"));

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 }
      );
    }

    await prisma.cartItem.delete({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CART DELETE ERROR:", error);
    return NextResponse.json(
      { error: "خطا در حذف از سبد خرید" },
      { status: 500 }
    );
  }
}