
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { addToCartSchema } from "@/lib/validations/cart";

const MAX_QUANTITY_PER_ITEM = 20;

function withAvailableStock(item) {
  if (!item?.product) return item;

  const {
    reservedStock,
    ...publicProduct
  } = item.product;

  const stock = Number(publicProduct.stock);
  const reserved = Number(reservedStock);

  const availableStock =
    publicProduct.isPublished &&
    !publicProduct.deletedAt &&
    Number.isFinite(stock) &&
    Number.isFinite(reserved)
      ? Math.max(0, stock - reserved)
      : 0;

  return {
    ...item,
    product: {
      ...publicProduct,
      availableStock,
    },
  };
}

// دریافت سبد خرید
export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نشدی" },
        { status: 401 },
      );
    }

    // حذف محصولات آرشیوشده از سبد خرید
    await prisma.cartItem.deleteMany({
      where: {
        userId: user.id,
        product: {
          is: {
            deletedAt: {
              not: null,
            },
          },
        },
      },
    });

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
        product: {
          is: {
            deletedAt: null,
          },
        },
      },
      include: {
        product: {
          include: {
            images: true,
          },
        },
      },
      orderBy: {
        id: "desc",
      },
    });

    return NextResponse.json(
      cartItems.map(withAvailableStock),
    );
  } catch (error) {
    console.error("CART GET ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت سبد خرید" },
      { status: 500 },
    );
  }
}

// افزودن به سبد خرید
export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نشدی" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);

    const parsed = addToCartSchema.safeParse({
      productId: Number(body?.productId),
      quantity: Number(body?.quantity),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "اطلاعات نامعتبر است",
        },
        { status: 400 },
      );
    }

    const { productId, quantity } = parsed.data;

    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return NextResponse.json(
        {
          error: `حداکثر ${MAX_QUANTITY_PER_ITEM} عدد از هر کالا مجاز است`,
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // قفل محصول برای خواندن موجودی به‌روز
      const rows = await tx.$queryRaw`
        SELECT
          "id",
          "stock",
          "reservedStock",
          "isPublished",
          "deletedAt"
        FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `;

      const product = rows[0];

      if (!product || product.deletedAt) {
        await tx.cartItem.deleteMany({
          where: {
            userId: user.id,
            productId,
          },
        });

        return { type: "UNAVAILABLE" };
      }

      if (!product.isPublished) {
        return { type: "UNPUBLISHED" };
      }

      const availableStock = Math.max(
        0,
        Number(product.stock) - Number(product.reservedStock),
      );

      if (availableStock <= 0) {
        return {
          type: "OUT_OF_STOCK",
          availableStock,
        };
      }

      const existingItem = await tx.cartItem.findUnique({
        where: {
          userId_productId: {
            userId: user.id,
            productId,
          },
        },
      });

      const newQuantity =
        (existingItem?.quantity || 0) + quantity;

      if (newQuantity > MAX_QUANTITY_PER_ITEM) {
        return { type: "MAX_QUANTITY" };
      }

      if (newQuantity > availableStock) {
        return {
          type: "INSUFFICIENT_STOCK",
          availableStock,
        };
      }

      const cartItem = existingItem
        ? await tx.cartItem.update({
            where: {
              userId_productId: {
                userId: user.id,
                productId,
              },
            },
            data: {
              quantity: newQuantity,
            },
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          })
        : await tx.cartItem.create({
            data: {
              userId: user.id,
              productId,
              quantity,
            },
            include: {
              product: {
                include: {
                  images: true,
                },
              },
            },
          });

      return {
        type: "SUCCESS",
        cartItem: withAvailableStock(cartItem),
      };
    });

    if (result.type === "UNAVAILABLE") {
      return NextResponse.json(
        { error: "این محصول دیگر در دسترس نیست" },
        { status: 404 },
      );
    }

    if (result.type === "UNPUBLISHED") {
      return NextResponse.json(
        { error: "این محصول در حال حاضر قابل خرید نیست" },
        { status: 409 },
      );
    }

    if (result.type === "OUT_OF_STOCK") {
      return NextResponse.json(
        { error: "موجودی این محصول به پایان رسیده است" },
        { status: 409 },
      );
    }

    if (result.type === "MAX_QUANTITY") {
      return NextResponse.json(
        {
          error: `حداکثر ${MAX_QUANTITY_PER_ITEM} عدد از هر کالا مجاز است`,
        },
        { status: 400 },
      );
    }

    if (result.type === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          error: `فقط ${result.availableStock} عدد از این محصول قابل خرید است`,
          availableStock: result.availableStock,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      result.cartItem,
      { status: 201 },
    );
  } catch (error) {
    console.error("CART POST ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در افزودن به سبد خرید" },
      { status: 500 },
    );
  }
}

// حذف کل سبد یا یک آیتم مشخص
export async function DELETE(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نشدی" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const productIdParam = searchParams.get("productId");

    if (!productIdParam) {
      await prisma.cartItem.deleteMany({
        where: {
          userId: user.id,
        },
      });

      return NextResponse.json({ success: true });
    }

    const productId = Number(productIdParam);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول نامعتبر است" },
        { status: 400 },
      );
    }

    await prisma.cartItem.deleteMany({
      where: {
        userId: user.id,
        productId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CART DELETE ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در حذف از سبد خرید" },
      { status: 500 },
    );
  }
}
