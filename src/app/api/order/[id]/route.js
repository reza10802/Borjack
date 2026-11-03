
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function DELETE(req, { params }) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نکرده‌اید" },
        { status: 401 },
      );
    }

    const orderId = Number((await params).id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "شناسه سفارش نامعتبر است" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // ترتیب قفل‌گذاری با مسیرهای payment/request و payment/verify یکسان است.
      await tx.$queryRaw`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;

      await tx.$queryRaw`
        SELECT "id"
        FROM "Order"
        WHERE "id" = ${orderId}
          AND "userId" = ${user.id}
        FOR UPDATE
      `;

      const order = await tx.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
        },
        include: {
          transaction: true,
        },
      });

      if (!order) {
        return {
          error: "سفارش پیدا نشد",
          status: 404,
        };
      }

      if (order.paymentStatus !== "PENDING") {
        return {
          error: "این سفارش قابل حذف نیست.",
          status: 400,
        };
      }

      // حتی اگر هنوز Authority ثبت نشده باشد،
      // وجود رزرو فعال به معنی در جریان بودن فرآیند پرداخت است.
      if (order.stockReservationStatus === "RESERVED") {
        return {
          error: "برای این سفارش رزرو موجودی فعال وجود دارد و امکان حذف آن نیست.",
          status: 409,
        };
      }

      // تراکنش در حال پرداخت یا پرداخت‌شده نباید حذف شود.
      if (
        order.transaction &&
        ["PENDING", "SUCCESS"].includes(order.transaction.status)
      ) {
        return {
          error: "وضعیت پرداخت این سفارش هنوز نهایی نشده و امکان حذف آن نیست.",
          status: 409,
        };
      }

      // فقط سفارش بدون رزرو فعال و بدون تراکنش فعال قابل حذف است.
      await tx.transaction.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await tx.order.delete({
        where: {
          id: order.id,
        },
      });

      return { success: true };
    });

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("ORDER_DELETE_ERROR", {
      message: err?.message,
    });

    return NextResponse.json(
      { error: "خطا در حذف سفارش" },
      { status: 500 },
    );
  }
}
