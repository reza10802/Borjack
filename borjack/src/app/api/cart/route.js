import { NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

function getUserFromRequest(req) {
    const token = req.cookies.get("token")?.value;
    if (!token) return null;
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

// GET /api/cart — گرفتن سبد خرید
export async function GET(req) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const cart = await prisma.cartItem.findMany({
            where: { userId: user.id },
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
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const { productId, quantity = 1 } = await req.json();

        if (!productId) return NextResponse.json({ error: "محصول الزامی است" }, { status: 400 });

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
        if (!product.inStock) return NextResponse.json({ error: "محصول ناموجود است" }, { status: 400 });

        const existing = await prisma.cartItem.findUnique({
            where: { userId_productId: { userId: user.id, productId } }
        });

        if (existing) {
            const updated = await prisma.cartItem.update({
                where: { userId_productId: { userId: user.id, productId } },
                data: { quantity: existing.quantity + quantity },
                include: { product: { include: { images: true } } }
            });
            return NextResponse.json(updated);
        }

        const item = await prisma.cartItem.create({
            data: { userId: user.id, productId, quantity },
            include: { product: { include: { images: true } } }
        });

        return NextResponse.json(item, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در افزودن به سبد" }, { status: 500 });
    }
}

// DELETE /api/cart — پاک کردن کل سبد
export async function DELETE(req) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        await prisma.cartItem.deleteMany({ where: { userId: user.id } });

        return NextResponse.json({ message: "سبد خرید پاک شد" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در پاک کردن سبد" }, { status: 500 });
    }
}