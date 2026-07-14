
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  ZARINPAL_REQUEST_URL,
  getZarinpalStartPayUrl,
} from "@/lib/zarinpal";

export async function POST() {
  const check = await requireAuth();
  if (check.error) return check.error;

  try {
    const userId = check.user.id;

    const order = await prisma.order.findFirst({
      where: {
        userId,
        paymentStatus: "PENDING",
      },
      include: {
        items: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "سفارش پرداخت‌نشده‌ای پیدا نشد" },
        { status: 404 }
      );
    }

    const amount = order.total;
    
    const merchant_id = process.env.ZARINPAL_MERCHANT_ID;
    const callback_url = `${process.env.NEXT_PUBLIC_SITE_URL}/api/payment/verify`;

    if (!merchant_id) {
      return NextResponse.json(
        { error: "ZARINPAL_MERCHANT_ID تنظیم نشده" },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SITE_URL تنظیم نشده" },
        { status: 500 }
      );
    }

    const payload = {
      merchant_id,
      amount,
      callback_url,
      description: `پرداخت سفارش #${order.id}`,
    };

    console.log("Zarinpal request payload:", payload);

    const response = await fetch(ZARINPAL_REQUEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("Zarinpal request response:", data);

    const result = data?.data;

    if (!result || result.code !== 100 || !result.authority) {
      return NextResponse.json(
        {
          error: "خطا در ایجاد پرداخت",
          zarinpal: data,
        },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentAuthority: result.authority,
      },
    });

    return NextResponse.json({
      success: true,
      authority: result.authority,
      paymentUrl: getZarinpalStartPayUrl(result.authority),
    });
  } catch (error) {
    console.error("Zarinpal request error:", error);
    return NextResponse.json(
      { error: "خطا در اتصال به درگاه" },
      { status: 500 }
    );
  }
}