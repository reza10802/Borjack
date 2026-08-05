import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireManagerOrAdmin, logAction } from "@/lib/auth";

// GET /api/admin/products — لیست محصولات
export async function GET(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: {
            id: true,
            title: true,
          },
        },
        images: true,
        specs: true,
      },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در دریافت محصولات" },
      { status: 500 },
    );
  }
}

// POST /api/admin/products — ساخت محصول جدید
export async function POST(req) {
  const check = await requireManagerOrAdmin(req);
  if (check.error) return check.error;

  try {
    const body = await req.json();
    const {
      title,
      price,
      originalPrice,
      discount,
      categoryId,
      image,
      gallery = [],
      description,
      stock,
    } = body;

    if (!title || price == null || !categoryId || !image || !description) {
      return NextResponse.json(
        { error: "همه فیلدهای ضروری را پر کنید" },
        { status: 400 },
      );
    }

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        price: Number(price),
        originalPrice:
          originalPrice != null && originalPrice !== ""
            ? Number(originalPrice)
            : Number(price),

        discount: Number(discount) || 0,

        category: {
          connect: {
            id: Number(categoryId),
          },
        },

        image,

        description: description.trim(),

        stock: Number(stock ?? 0),

        images: {
          create: gallery.map((url) => ({
            url,
          })),
        },
      },
      include: {
        category: true,
        images: true,
        specs: true,
      },
    });

    await logAction(req, {
      userId: check.user.id,
      action: "CREATE_PRODUCT",
      entityType: "Product",
      entityId: String(product.id),
      description: `محصول «${product.title}» ایجاد شد`,
      newValue: product,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "خطا در ساخت محصول" }, { status: 500 });
  }
}
