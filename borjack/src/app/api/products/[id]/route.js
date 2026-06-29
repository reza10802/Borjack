import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function GET(req, { params }) {
    try {
        const { id } = await params;

        const product = await prisma.product.findUnique({
            where: { id: Number(id) },
            include: {
                images: true,
                specs: true,
                reviews: { orderBy: { createdAt: "desc" } },
            },
        });

        if (!product) {
            return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
        }

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در دریافت محصول" }, { status: 500 });
    }
}