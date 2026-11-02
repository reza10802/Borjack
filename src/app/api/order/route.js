
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, logAction } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/checkout";
import { validateProvinceCity } from "@/lib/iranLocations";

const SHIPPING_METHODS = new Set(["POST", "TIPAX", "SNAPPBOX"]);

function getCartSnapshot(items) {
  return items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.product.price),
    }))
    .sort((a, b) => a.productId - b.productId);
}

function isSameCheckout(order, data) {
  const oldItems = order.items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
    }))
    .sort((a, b) => a.productId - b.productId);

  const newItems = getCartSnapshot(data.cartItems);

  const sameItems =
    JSON.stringify(oldItems) === JSON.stringify(newItems);

  const sameReceiver =
    order.receiverName === data.receiverName &&
    order.receiverPhone === data.receiverPhone &&
    order.provinceId === data.provinceId &&
    order.cityId === data.cityId &&
    order.address === data.address &&
    order.postalCode === data.postalCode &&
    order.shippingMethod === data.shippingMethod;

  return sameItems && sameReceiver &&
    Number(order.total) === Number(data.total);
}

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        paymentStatus: {
          in: ["PAID", "PENDING"],
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: {
              include: { images: true },
            },
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error("GET_ORDERS_ERROR", error);

    return NextResponse.json(
      { error: "خطا در دریافت سفارش‌ها" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "اطلاعات سفارش معتبر نیست",
        },
        { status: 400 },
      );
    }

    const {
      receiverName,
      receiverPhone,
      provinceId,
      cityId,
      address,
      postalCode,
    } = parsed.data;

    const shippingMethod = SHIPPING_METHODS.has(body?.shippingMethod)
      ? body.shippingMethod
      : "POST";

    const location = validateProvinceCity(provinceId, cityId);

    if (!location.valid) {
      return NextResponse.json(
        { error: location.message },
        { status: 400 },
      );
    }

    const { province, city } = location;

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
    });

    if (!cartItems.length) {
      return NextResponse.json(
        { error: "سبد خرید خالی است" },
        { status: 400 },
      );
    }

    for (const item of cartItems) {
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          { error: "تعداد یکی از کالاهای سبد خرید معتبر نیست" },
          { status: 400 },
        );
      }

      if (
        !item.product.isPublished ||
        item.product.stock < item.quantity
      ) {
        return NextResponse.json(
          {
            error: `کالای «${item.product.title}» منتشر نشده یا موجودی کافی ندارد.`,
          },
          { status: 409 },
        );
      }
    }

    const total = cartItems.reduce(
      (sum, item) =>
        sum + Number(item.product.price) * Number(item.quantity),
      0,
    );

    if (!Number.isSafeInteger(total) || total <= 0) {
      return NextResponse.json(
        { error: "مبلغ سفارش معتبر نیست" },
        { status: 400 },
      );
    }

    // آخرین سفارش پرداخت‌نشده و هنوز لغو‌نشدهٔ کاربر
    const pendingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        paymentStatus: "PENDING",
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        transaction: true,
      },
    });

    if (pendingOrder) {
      const checkoutData = {
        receiverName,
        receiverPhone,
        provinceId: province.id,
        cityId: city.id,
        address,
        postalCode,
        shippingMethod,
        cartItems,
        total,
      };

      const sameCheckout = isSameCheckout(
        pendingOrder,
        checkoutData,
      );

      // پرداختی که هنوز در جریان است نباید با سفارش جدید جایگزین شود.
      if (pendingOrder.transaction?.status === "PENDING") {
        if (!pendingOrder.authority) {
          return NextResponse.json(
            {
              error:
                "وضعیت پرداخت سفارش قبلی نیاز به بررسی دارد. لطفاً با پشتیبانی تماس بگیرید.",
            },
            { status: 409 },
          );
        }

        if (!sameCheckout) {
          return NextResponse.json(
            {
              error:
                "برای شما یک سفارش با پرداخت در حال انجام وجود دارد. ابتدا وضعیت آن را مشخص کنید.",
            },
            { status: 409 },
          );
        }

        return NextResponse.json({
          success: true,
          orderId: pendingOrder.id,
          reused: true,
        });
      }

      // تراکنش موفق با سفارش پرداخت‌نشده، وضعیت ناسازگار است.
      if (pendingOrder.transaction?.status === "SUCCESS") {
        return NextResponse.json(
          {
            error:
              "وضعیت سفارش نیاز به بررسی دارد. لطفاً با پشتیبانی تماس بگیرید.",
          },
          { status: 409 },
        );
      }

      // وجود Authority بدون رکورد تراکنش را خودکار بازنویسی نمی‌کنیم.
      if (pendingOrder.authority && !pendingOrder.transaction) {
        return NextResponse.json(
          {
            error:
              "اطلاعات پرداخت سفارش قبلی ناقص است و نیاز به بررسی دارد.",
          },
          { status: 409 },
        );
      }

      // اگر اطلاعات یکسان است، همان سفارش قابل استفاده است.
      if (sameCheckout) {
        return NextResponse.json({
          success: true,
          orderId: pendingOrder.id,
          reused: true,
        });
      }

      // سفارش قبلی پرداخت نشده و تراکنش فعال ندارد؛ آن را به‌روز می‌کنیم.
      await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({
          where: { orderId: pendingOrder.id },
        });

        await tx.order.update({
          where: { id: pendingOrder.id },
          data: {
            receiverName,
            receiverPhone,
            provinceId: province.id,
            provinceName: province.name,
            cityId: city.id,
            cityName: city.name,
            address,
            postalCode,
            shippingMethod,
            shippingCost: 0,
            total,
            status: "PENDING",
            paymentStatus: "PENDING",
            authority: null,
            refId: null,
            paidAt: null,
            paymentExpiresAt: null,
          },
        });

        await tx.orderItem.createMany({
          data: cartItems.map((item) => ({
            orderId: pendingOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        });
      });

      return NextResponse.json({
        success: true,
        orderId: pendingOrder.id,
        reused: true,
      });
    }

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        receiverName,
        receiverPhone,
        provinceId: province.id,
        provinceName: province.name,
        cityId: city.id,
        cityName: city.name,
        address,
        postalCode,
        shippingMethod,
        shippingCost: 0,
        total,
        status: "PENDING",
        paymentStatus: "PENDING",
        items: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
    });

    await logAction({
      userId: user.id,
      action: "CREATE_ORDER",
      entityType: "ORDER",
      entityId: String(order.id),
      description: `سفارش #${order.id} ثبت شد`,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("CREATE_ORDER_ERROR", error);

    return NextResponse.json(
      { error: "خطا در ثبت سفارش" },
      { status: 500 },
    );
  }
}
