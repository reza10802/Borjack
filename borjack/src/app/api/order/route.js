import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, logAction } from "@/lib/auth";

// GET /api/orders — گرفتن سفارشات کاربر فعلی
export async function GET(req) {
    try {
        const user = await getCurrentUser(req);
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

// POST /api/orders — ثبت سفارش جدید از روی سبد خرید
export async function POST(req) {
    try {
        const user = await getCurrentUser(req);
        if (!user) return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });

        const cartItems = await prisma.cartItem.findMany({
            where: { userId: user.id },
            include: { product: true }
        });

        if (cartItems.length === 0) {
            return NextResponse.json({ error: "سبد خرید خالی است" }, { status: 400 });
        }

        const total = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

        // status عمداً ست نشده — مقدار پیش‌فرض enum (PENDING) از schema گرفته می‌شه
        const order = await prisma.order.create({
            data: {
                userId: user.id,
                total,
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

        await prisma.cartItem.deleteMany({ where: { userId: user.id } });

        await logAction(req, {
            userId: user.id,
            action: "CREATE_ORDER",
            entityType: "Order",
            entityId: order.id,
            description: `سفارش #${order.id} توسط مشتری ثبت شد`,
            newValue: { total, itemCount: cartItems.length },
        });

        return NextResponse.json(order, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در ثبت سفارش" }, { status: 500 });
    }
}