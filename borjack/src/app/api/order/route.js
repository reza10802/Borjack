import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, logAction } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/checkout";
import { validateProvinceCity } from "@/lib/iranLocations";

const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// GET /api/order — سفارشات کاربر فعلی
export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
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
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json(
      { error: "خطا در دریافت سفارشات" },
      { status: 500 }
    );
  }
}

// POST /api/order — ثبت سفارش + ساخت لینک پرداخت
export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "اطلاعات فرم ناقص یا نامعتبر است" },
        { status: 400 }
      );
    }

    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات چک‌اوت نامعتبر است";

      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const {
      receiverName,
      receiverPhone,
      provinceId,
      cityId,
      address,
      postalCode,
    } = parsed.data;

    const locationValidation = validateProvinceCity(provinceId, cityId);

    if (!locationValidation.valid) {
      return NextResponse.json(
        { error: locationValidation.message },
        { status: 400 }
      );
    }

    const { province, city } = locationValidation;

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: {
        product: true,
      },
    });

    if (!cartItems.length) {
      return NextResponse.json(
        { error: "سبد خرید خالی است" },
        { status: 400 }
      );
    }

    const total = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * Number(item.quantity),
      0
    );

    // 1) ساخت سفارش
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
              include: { images: true },
            },
          },
        },
      },
    });

    // 2) لاگ
    await logAction({
      userId: user.id,
      action: "CREATE_ORDER",
      entityType: "ORDER",
      entityId: order.id,
      description: `سفارش #${order.id} ثبت شد`,
      newValue: {
        total,
        itemCount: cartItems.length,
        receiverName,
        receiverPhone,
        province: province.name,
        city: city.name,
      },
    });

    // 3) پاک کردن سبد خرید
    await prisma.cartItem.deleteMany({
      where: { userId: user.id },
    });

    // اگر merchant id تنظیم نشده بود، فعلاً سفارش ساخته می‌شود ولی درگاه نداریم
    if (!ZARINPAL_MERCHANT_ID) {
      return NextResponse.json(
        {
          order,
          error: "Merchant ID زرین‌پال تنظیم نشده است",
        },
        { status: 201 }
      );
    }

    // 4) ساخت درخواست پرداخت زرین‌پال
    const callbackUrl = `${SITE_URL}/api/payment/verify?orderId=${order.id}`;

    const paymentBody = {
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: total,
      callback_url: callbackUrl,
      description: `پرداخت سفارش شماره ${order.id}`,
      metadata: {
        mobile: receiverPhone,
      },
    };

    const paymentRes = await fetch(
      "https://sandbox.zarinpal.com/pg/v4/payment/request.json",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(paymentBody),
      }
    );

    const paymentData = await paymentRes.json();

    const authority = paymentData?.data?.authority;

    if (!authority) {
      console.error("ZARINPAL REQUEST ERROR:", paymentData);

      return NextResponse.json(
        {
          order,
          error: "خطا در ساخت لینک پرداخت",
          zarinpal: paymentData,
        },
        { status: 500 }
      );
    }

    // اگر توی مدل Order فیلد authority داری، ذخیره‌اش کن
    try {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          authority,
        },
      });
    } catch {
      // اگر ستون authority هنوز در مدل نداری، خطا نده
    }

    const paymentUrl = `https://sandbox.zarinpal.com/pg/StartPay/${authority}`;

    return NextResponse.json(
      {
        success: true,
        order,
        authority,
        paymentUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST ORDER ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ثبت سفارش" },
      { status: 500 }
    );
  }
}