import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

// GET /api/cart — گرفتن سبد خرید
export async function GET() {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        const cart = await prisma.cartItem.findMany({
            where: { userId: check.session.id },
            include: {
                product: {
                    include: { images: true }
                }
            }
        });

        return NextResponse.json(cart);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در دریافت سبد خرید" }, { status: 500 });
    }
}

// POST /api/cart — افزودن به سبد
export async function POST(req) {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        const userId = check.session.id;
        const { productId, quantity = 1 } = await req.json();

        if (!productId) return NextResponse.json({ error: "محصول الزامی است" }, { status: 400 });

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
        if (!product.inStock) return NextResponse.json({ error: "محصول ناموجود است" }, { status: 400 });

        const existing = await prisma.cartItem.findUnique({
            where: { userId_productId: { userId, productId } }
        });

        if (existing) {
            const updated = await prisma.cartItem.update({
                where: { userId_productId: { userId, productId } },
                data: { quantity: existing.quantity + quantity },
                include: { product: { include: { images: true } } }
            });
            return NextResponse.json(updated);
        }

        const item = await prisma.cartItem.create({
            data: { userId, productId, quantity },
            include: { product: { include: { images: true } } }
        });

        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در افزودن به سبد" }, { status: 500 });
    }
}

// DELETE /api/cart — پاک کردن کل سبد
export async function DELETE() {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        await prisma.cartItem.deleteMany({ where: { userId: check.session.id } });
        return NextResponse.json({ message: "سبد خرید پاک شد" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در پاک کردن سبد" }, { status: 500 });
    }
}