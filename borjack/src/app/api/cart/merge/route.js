import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

const MAX_QUANTITY_PER_ITEM = 20;

export async function POST(req) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items : [];

    for (const raw of items) {
      const productId = Number(raw.productId);
      const quantity = Number(raw.quantity);

      if (
        !Number.isInteger(productId) ||
        !Number.isInteger(quantity) ||
        quantity < 1
      ) {
        continue;
      }

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });
      if (!product) continue;

      const existing = await prisma.cartItem.findUnique({
        where: { userId_productId: { userId: user.id, productId } },
      });

      if (existing) {
        await prisma.cartItem.update({
          where: { userId_productId: { userId: user.id, productId } },
          data: {
            quantity: Math.min(
              existing.quantity + quantity,
              MAX_QUANTITY_PER_ITEM,
            ),
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            userId: user.id,
            productId,
            quantity: Math.min(quantity, MAX_QUANTITY_PER_ITEM),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CART MERGE ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ادغام سبد خرید" },
      { status: 500 },
    );
  }
}