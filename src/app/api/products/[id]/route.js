import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req, { params }) {
  try {
    const user = await getSessionUser();
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        images: true,
        specs: true,
        reviews: {
          where: { approved: true },
          orderBy: { createdAt: "desc" },
        },
        ...(user
          ? {
              wishlistItems: {
                where: { userId: user.id },
                select: { id: true },
              },
            }
          : {}),
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 }
      );
    }

    const normalized = {
      ...product,
      image: product.images?.[0]?.url || product.image,
      isWishlisted: user ? product.wishlistItems.length > 0 : false,
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت محصول" },
      { status: 500 }
    );
  }
}