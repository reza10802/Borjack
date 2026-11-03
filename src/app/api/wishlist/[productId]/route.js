
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// DELETE /api/wishlist/[productId]
// حذف محصول از علاقه‌مندی‌های کاربر
export async function DELETE(req, { params }) {
  try {
    const user = await getSessionUser(req);

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const { productId: rawProductId } = await params;
    const productId = Number(rawProductId);

    // اعتبارسنجی شناسه محصول
    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
      );
    }

    // حذف فقط علاقه‌مندی متعلق به کاربر فعلی
    await prisma.wishlistItem.deleteMany({
      where: {
        userId: user.id,
        productId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "محصول از علاقه‌مندی‌ها حذف شد",
    });
  } catch (error) {
    console.error("WISHLIST DELETE ERROR:", error);

    return NextResponse.json(
      { error: "خطا در حذف از علاقه‌مندی‌ها" },
      { status: 500 },
    );
  }
}
