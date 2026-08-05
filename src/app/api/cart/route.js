import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { addToCartSchema } from "@/lib/validations/cart";

const MAX_QUANTITY_PER_ITEM = 20;
// گرفتن آیتم‌های سبد خرید
export async function GET() {
  try {
    const user = await getSessionUser();

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
      { status: 500 },
    );
  }
}

// افزودن به سبد خرید
export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const body = await req.json();

    const parsed = addToCartSchema.safeParse({
      productId: Number(body.productId),
      quantity: Number(body.quantity),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" },
        { status: 400 },
      );
    }

    const { productId, quantity } = parsed.data;

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "محصول یافت نشد" }, { status: 404 });
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: { userId: user.id, productId },
      },
    });

    let cartItem;

    if (existingItem) {
      const newQuantity = Math.min(
        existingItem.quantity + quantity,
        MAX_QUANTITY_PER_ITEM,
      );

      cartItem = await prisma.cartItem.update({
        where: {
          userId_productId: { userId: user.id, productId },
        },
        data: { quantity: newQuantity },
        include: { product: { include: { images: true } } },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: { userId: user.id, productId, quantity },
        include: { product: { include: { images: true } } },
      });
    }

    return NextResponse.json(cartItem, { status: 201 });
  } catch (error) {
    console.error("CART POST ERROR:", error);
    return NextResponse.json(
      { error: "خطا در افزودن به سبد خرید" },
      { status: 500 },
    );
  }
}

// حذف کل سبد یا یک آیتم مشخص (اگر productId داده نشود، کل سبد پاک می‌شود)
export async function DELETE(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productIdParam = searchParams.get("productId");

    if (!productIdParam) {
      await prisma.cartItem.deleteMany({
        where: { userId: user.id },
      });
      return NextResponse.json({ success: true });
    }

    const productId = Number(productIdParam);

    if (!productId || Number.isNaN(productId)) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
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
      { status: 500 },
    );
  }
}