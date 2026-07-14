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

        const qty = Number(quantity);
        if (!Number.isInteger(qty) || qty < 1) {
            return NextResponse.json(
                { error: "تعداد نامعتبر است" },
                { status: 400 }
            );
        }

        const numericProductId = Number(productId);
        if (!Number.isInteger(numericProductId)) {
            return NextResponse.json(
                { error: "شناسه محصول نامعتبر است" },
                { status: 400 }
            );
        }

        const existing = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: check.user.id,
                    productId: numericProductId,
                },
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "آیتمی در سبد خرید پیدا نشد" },
                { status: 404 }
            );
        }

        const updated = await prisma.cartItem.update({
            where: {
                userId_productId: {
                    userId: check.user.id,
                    productId: numericProductId,
                },
            },
            data: { quantity: qty },
            include: {
                product: {
                    include: { images: true },
                },
            },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("PATCH /api/cart/[productId] error:", error);
        return NextResponse.json(
            { error: "خطا در آپدیت سبد" },
            { status: 500 }
        );
    }
}

// DELETE /api/cart/[productId] — حذف آیتم
export async function DELETE(req, { params }) {
    const check = await requireAuth();
    if (check.error) return check.error;

    try {
        const { productId } = await params;
        const numericProductId = Number(productId);

        if (!Number.isInteger(numericProductId)) {
            return NextResponse.json(
                { error: "شناسه محصول نامعتبر است" },
                { status: 400 }
            );
        }

        const existing = await prisma.cartItem.findUnique({
            where: {
                userId_productId: {
                    userId: check.user.id,
                    productId: numericProductId,
                },
            },
        });

        if (!existing) {
            return NextResponse.json(
                { error: "آیتمی در سبد خرید پیدا نشد" },
                { status: 404 }
            );
        }

        await prisma.cartItem.delete({
            where: {
                userId_productId: {
                    userId: check.user.id,
                    productId: numericProductId,
                },
            },
        });

        return NextResponse.json({ message: "آیتم حذف شد" });
    } catch (error) {
        console.error("DELETE /api/cart/[productId] error:", error);
        return NextResponse.json(
            { error: "خطا در حذف آیتم" },
            { status: 500 }
        );
    }
}