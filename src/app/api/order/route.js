import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, logAction } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/checkout";
import { validateProvinceCity } from "@/lib/iranLocations";

const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        paymentStatus: {
          in: ["PAID", "PENDING"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "خطا در دریافت سفارشات" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const body = await req.json();

    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      console.log(parsed.error.issues);
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message,
        },
        {
          status: 400,
        },
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

    const location = validateProvinceCity(provinceId, cityId);

    if (!location.valid) {
      return NextResponse.json(
        {
          error: location.message,
        },
        {
          status: 400,
        },
      );
    }

    const { province, city } = location;

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
      },
      include: {
        product: true,
      },
    });

    if (!cartItems.length) {
      return NextResponse.json(
        {
          error: "سبد خرید خالی است",
        },
        {
          status: 400,
        },
      );
    }

    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * Number(item.quantity),
      0,
    );

    // اگر سفارش پرداخت‌نشده‌ای وجود دارد همان را برگردان
    const pendingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        paymentStatus: "PENDING",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (pendingOrder) {
      return NextResponse.json({
        success: true,
        order: pendingOrder,
        authority: pendingOrder.authority,
        paymentUrl: `https://sandbox.zarinpal.com/pg/StartPay/${pendingOrder.authority}`,
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
      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
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

    if (!ZARINPAL_MERCHANT_ID) {
      return NextResponse.json(
        {
          error: "Merchant ID تنظیم نشده",
        },
        {
          status: 500,
        },
      );
    }

    const callbackUrl = `${SITE_URL}/api/payment/verify`;
    const paymentResponse = await fetch(
      "https://sandbox.zarinpal.com/pg/v4/payment/request.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          merchant_id: ZARINPAL_MERCHANT_ID,
          amount: total,
          callback_url: callbackUrl,
          description: `پرداخت سفارش شماره ${order.id}`,
          metadata: {
            mobile: receiverPhone,
          },
        }),
      },
    );

    const paymentData = await paymentResponse.json();

    if (!paymentData?.data?.authority) {
      console.error(paymentData);

      return NextResponse.json(
        {
          error: "خطا در ساخت پرداخت",
        },
        {
          status: 500,
        },
      );
    }

    const authority = paymentData.data.authority;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        authority,
      },
    });

    await prisma.transaction.create({
      data: {
        orderId: order.id,
        authority,
        amount: total,
        status: "PENDING",
        gateway: "ZARINPAL",
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      authority,
      paymentUrl: `https://sandbox.zarinpal.com/pg/StartPay/${authority}`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "خطا در ثبت سفارش",
      },
      {
        status: 500,
      },
    );
  }
}
