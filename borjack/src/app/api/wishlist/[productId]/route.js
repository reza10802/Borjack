import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req, { params }) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const { productId } = await params;

    await prisma.wishlistItem.deleteMany({
      where: {
        userId: user.id,
        productId: Number(productId),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در حذف از علاقه‌مندی‌ها" },
      { status: 500 }
    );
  }
}