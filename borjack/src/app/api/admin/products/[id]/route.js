import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, requireAdmin, logAction } from "@/lib/auth";

// PATCH /api/admin/products/[id] — ویرایش محصول (ADMIN یا MANAGER؛ مثلا تغییر موجودی یا قیمت)
export async function PATCH(req, { params }) {
    const check = await requireManagerOrAdmin(req);
    if (check.error) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    try {
        const { id } = await params;
        const body = await req.json();

        const allowedFields = ["title", "price", "originalPrice", "discount", "category", "image", "description", "inStock"];
        const data = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined) data[field] = body[field];
        }

        const before = await prisma.product.findUnique({ where: { id: Number(id) } });

        const product = await prisma.product.update({
            where: { id: Number(id) },
            data,
            include: { images: true, specs: true },
        });

        // اگه فقط inStock عوض شده، لاگ رو با action مخصوص موجودی ثبت می‌کنیم
        const isStockOnly = Object.keys(data).length === 1 && "inStock" in data;

        await logAction(req, {
            userId: check.user.id,
            action: isStockOnly ? "UPDATE_STOCK" : "UPDATE_PRODUCT",
            entityType: "Product",
            entityId: id,
            description: `محصول «${product.title}» ویرایش شد`,
            oldValue: before,
            newValue: data,
        });

        return NextResponse.json(product);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در ویرایش محصول" }, { status: 500 });
    }
}

// DELETE /api/admin/products/[id] — حذف محصول (فقط ADMIN)
export async function DELETE(req, { params }) {
    const check = await requireAdmin(req);
    if (check.error) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    try {
        const { id } = await params;
        const productId = Number(id);

        const product = await prisma.product.findUnique({ where: { id: productId } });
        if (!product) {
            return NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });
        }

        const orderItemCount = await prisma.orderItem.count({ where: { productId } });
        if (orderItemCount > 0) {
            return NextResponse.json(
                { error: "این محصول توی سفارشات قبلی استفاده شده و قابل حذف نیست. به‌جای حذف، وضعیت موجودی رو ناموجود کن." },
                { status: 409 }
            );
        }

        await prisma.review.deleteMany({ where: { productId } });
        await prisma.productSpec.deleteMany({ where: { productId } });
        await prisma.productImage.deleteMany({ where: { productId } });
        await prisma.cartItem.deleteMany({ where: { productId } });

        await prisma.product.delete({ where: { id: productId } });

        await logAction(req, {
            userId: check.user.id,
            action: "DELETE_PRODUCT",
            entityType: "Product",
            entityId: id,
            description: `محصول «${product?.title}» حذف شد`,
            oldValue: product,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در حذف محصول" }, { status: 500 });
    }
}