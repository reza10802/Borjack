import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ZARINPAL_VERIFY_URL } from "@/lib/zarinpal";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const authority = searchParams.get("Authority");
    const status = searchParams.get("Status");

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    if (!authority) {
      return NextResponse.redirect(`${siteUrl}/?payment=failed`);
    }

    const order = await prisma.order.findFirst({
      where: { paymentAuthority: authority },
    });

    if (!order) {
      return NextResponse.redirect(`${siteUrl}/?payment=order-not-found`);
    }

    // کاربر پرداخت را لغو کرده
    if (status !== "OK") {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "FAILED",
        },
      });

      return NextResponse.redirect(`${siteUrl}/?payment=canceled`);
    }

    const merchant_id = process.env.ZARINPAL_MERCHANT_ID;

    // مبلغ باید دقیقاً همان مبلغی باشد که در request فرستاده شد
    const amount = order.total;

    const payload = {
      merchant_id,
      amount,
      authority,
    };

    console.log("Zarinpal verify payload:", payload);

    const response = await fetch(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("Zarinpal verify response:", data);

    const result = data?.data;

    // 100 = موفق
    // 101 = قبلاً تایید شده
    if (result?.code === 100 || result?.code === 101) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          paidAt: new Date(),
          paymentRefId: result.ref_id ? String(result.ref_id) : null,
        },
      });

      // بعد از پرداخت موفق → صفحه فروشگاه
      return NextResponse.redirect(
        `${siteUrl}/?payment=success&orderId=${order.id}`
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "FAILED",
      },
    });

    return NextResponse.redirect(`${siteUrl}/?payment=failed&orderId=${order.id}`);
  } catch (error) {
    console.error("Zarinpal verify error:", error);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/?payment=failed`
    );
  }
}