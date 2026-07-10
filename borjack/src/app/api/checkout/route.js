import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireVerifiedUser, logAction } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/auth";

export async function POST(req) {
  try {
    const auth = await requireVerifiedUser();
    if (auth.error) return auth.error;

    const body = await req.json();

    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const {
      fullName,
      phone,
      email,
      province,
      city,
      address,
      postalCode,
      saveAddress,
    } = parsed.data;

    const cartItems = await prisma.cartItem.findMany({
      where: { userId: auth.user.id },
      include: { product: true },
    });

    if (cartItems.length === 0) {
      return NextResponse.json(
        { error: "سبد خرید خالی است" },
        { status: 400 }
      );
    }

    const total = cartItems.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    // ایمیل کاربر اگر خالی بود و در checkout وارد شد ذخیره شود
    if (email && !auth.user.email) {
      await prisma.user.update({
        where: { id: auth.user.id },
        data: { email },
      });
    }

    if (saveAddress) {
      const existingDefault = await prisma.address.findFirst({
        where: {
          userId: auth.user.id,
          fullName,
          phone,
          province,
          city,
          address,
          postalCode,
        },
      });

      if (!existingDefault) {
        await prisma.address.create({
          data: {
            userId: auth.user.id,
            fullName,
            phone,
            province,
            city,
            address,
            postalCode,
            isDefault: false,
          },
        });
      }
    }

    const order = await prisma.order.create({
      data: {
        userId: auth.user.id,
        total,
        status: "PENDING",
        paymentStatus: "PENDING",

        receiverName: fullName,
        receiverPhone: phone,
        province,
        city,
        address,
        postalCode,
        email: email || null,

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
            product: { include: { images: true } },
          },
        },
      },
    });

    await prisma.cartItem.deleteMany({
      where: { userId: auth.user.id },
    });

    await logAction({
      userId: auth.user.id,
      action: "CREATE_ORDER",
      entityType: "ORDER",
      entityId: String(order.id),
      description: `سفارش #${order.id} توسط مشتری ثبت شد`,
      newValue: {
        total,
        itemCount: cartItems.length,
      },
    });

    // TODO: اینجا بعداً درخواست زرین‌پال را می‌سازی
    // فعلاً برای تست order را برمی‌گردانیم
    return NextResponse.json({
      success: true,
      order,
      paymentUrl: null,
      message: "سفارش با موفقیت ثبت شد",
    });
  } catch (error) {
    console.error("CHECKOUT ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ثبت سفارش" },
      { status: 500 }
    );
  }
}