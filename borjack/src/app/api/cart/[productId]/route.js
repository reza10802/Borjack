import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
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

// PATCH /api/cart/[productId] — آپدیت تعداد
export async function PATCH(req, { params }) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const { productId } = await params;
        const { quantity } = await req.json();

        if (quantity < 1) return NextResponse.json({ error: "تعداد نامعتبر" }, { status: 400 });

        const updated = await prisma.cartItem.update({
            where: { userId_productId: { userId: user.id, productId: Number(productId) } },
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
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const { productId } = await params;

        await prisma.cartItem.delete({
            where: { userId_productId: { userId: user.id, productId: Number(productId) } }
        });

        return NextResponse.json({ message: "آیتم حذف شد" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در حذف آیتم" }, { status: 500 });
    }
}