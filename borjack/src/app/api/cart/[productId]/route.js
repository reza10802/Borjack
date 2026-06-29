import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// PATCH /api/cart/[productId] — آپدیت تعداد
export async function PATCH(req, { params }) {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        const { productId } = await params;
        const { quantity } = await req.json();

        if (quantity < 1) return NextResponse.json({ error: "تعداد نامعتبر" }, { status: 400 });

        const updated = await prisma.cartItem.update({
            where: { userId_productId: { userId: check.session.id, productId: Number(productId) } },
            data: { quantity },
            include: { product: { include: { images: true } } }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در آپدیت سبد" }, { status: 500 });
    }
}

// DELETE /api/cart/[productId] — حذف آیتم
export async function DELETE(req, { params }) {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        const { productId } = await params;

        await prisma.cartItem.delete({
            where: { userId_productId: { userId: check.session.id, productId: Number(productId) } }
        });

        return NextResponse.json({ message: "آیتم حذف شد" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در حذف آیتم" }, { status: 500 });
    }
}