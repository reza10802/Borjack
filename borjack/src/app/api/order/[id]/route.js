import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req, { params }) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نکرده‌اید" },
        { status: 401 }
      );
    }

    const orderId = Number((await params).id);

    if (!orderId) {
      return NextResponse.json(
        { error: "شناسه سفارش نامعتبر است" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId: user.id,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "سفارش پیدا نشد" },
        { status: 404 }
      );
    }

    if (order.paymentStatus !== "PENDING") {
      return NextResponse.json(
        { error: "این سفارش قابل حذف نیست." },
        { status: 400 }
      );
    }

    await prisma.transaction.deleteMany({
      where: {
        orderId,
      },
    });

    await prisma.order.delete({
      where: {
        id: orderId,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "خطا در حذف سفارش" },
      { status: 500 }
    );
  }
}