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

// GET /api/orders — گرفتن سفارشات کاربر
export async function GET(req) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const orders = await prisma.order.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: true }
                        }
                    }
                }
            }
        });

        return NextResponse.json(orders);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در دریافت سفارشات" }, { status: 500 });
    }
}

// POST /api/orders — ثبت سفارش جدید
export async function POST(req) {
    try {
        const user = getUserFromRequest(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        // گرفتن سبد خرید
        const cartItems = await prisma.cartItem.findMany({
            where: { userId: user.id },
            include: { product: true }
        });

        if (cartItems.length === 0) {
            return NextResponse.json({ error: "سبد خرید خالی است" }, { status: 400 });
        }

        const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

        // ساخت سفارش
        const order = await prisma.order.create({
            data: {
                userId: user.id,
                total,
                status: "در انتظار پرداخت",
                items: {
                    create: cartItems.map(item => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.product.price,
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        product: { include: { images: true } }
                    }
                }
            }
        });

        // پاک کردن سبد خرید
        await prisma.cartItem.deleteMany({ where: { userId: user.id } });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در ثبت سفارش" }, { status: 500 });
    }
}