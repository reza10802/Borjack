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

    // پیدا کردن سفارش
    const order = await prisma.order.findFirst({
      where: {
        authority,
      },
    });

    if (!order) {
      return NextResponse.redirect(`${siteUrl}/?payment=order-not-found`);
    }

    // کاربر پرداخت را لغو کرده
    if (status !== "OK") {
      await prisma.transaction.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await prisma.order.delete({
        where: {
          id: order.id,
        },
      });

      return NextResponse.redirect(`${siteUrl}/?payment=canceled`);
    }

    const payload = {
      merchant_id: process.env.ZARINPAL_MERCHANT_ID,
      authority,
      amount: order.total,
    };

    const response = await fetch(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    const result = data?.data;

    if (result?.code === 100 || result?.code === 101) {
      // آپدیت سفارش
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          paymentStatus: "PAID",
          status: "PROCESSING",
          paidAt: new Date(),
          refId: String(result.ref_id),
        },
      });

      // آپدیت تراکنش
      await prisma.transaction.update({
        where: {
          orderId: order.id,
        },
        data: {
          status: "SUCCESS",
          refId: String(result.ref_id),
        },
      });

      console.log("STATUS:", status);
      console.log("VERIFY RESULT:", result);
      console.log("ORDER:", order);

      console.log("Deleting cart for user:", order.userId);

      const deleted = await prisma.cartItem.deleteMany({
        where: {
          userId: order.userId,
        },
      });

      console.log("Deleted:", deleted);
      // پاک کردن سبد خرید
      await prisma.cartItem.deleteMany({
        where: {
          userId: order.userId,
        },
      });

      return NextResponse.redirect(`${siteUrl}/profile?payment=success`);
    }

    await prisma.transaction.deleteMany({
      where: {
        orderId: order.id,
      },
    });

    await prisma.order.delete({
      where: {
        id: order.id,
      },
    });

    return NextResponse.redirect(`${siteUrl}/?payment=failed`);
  } catch (error) {
    console.error("VERIFY ERROR:", error);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/?payment=failed`,
    );
  }
}
