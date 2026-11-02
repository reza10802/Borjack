
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ZARINPAL_GATEWAY_NAME,
  ZARINPAL_VERIFY_URL,
  toZarinpalAmount,
} from "@/lib/zarinpal";

function getSiteUrl() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site";

  try {
    return new URL(raw).origin;
  } catch {
    return "https://borjak.site";
  }
}

export async function GET(req) {
  const siteUrl = getSiteUrl();

  const redirectTo = (path) =>
    NextResponse.redirect(new URL(path, siteUrl));

  let orderId = null;

  try {
    const { searchParams } = new URL(req.url);

    const authority = searchParams.get("Authority");
    const gatewayStatus = searchParams.get("Status");

    if (!authority || authority.length > 100) {
      return redirectTo("/?payment=failed");
    }

    const order = await prisma.order.findUnique({
      where: { authority },
      include: {
        transaction: true,
        items: true,
      },
    });

    if (!order) {
      return redirectTo("/?payment=order-not-found");
    }

    orderId = order.id;

    // Callback تکراری برای سفارشی که قبلاً پرداخت شده است.
    if (order.paymentStatus === "PAID") {
      return redirectTo("/profile?payment=success");
    }

    if (order.paymentStatus !== "PENDING") {
      return redirectTo("/profile?payment=failed");
    }

    const transaction = order.transaction;

    // فقط تراکنشی که دقیقاً متعلق به همین سفارش و همین محیط است معتبر است.
    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(order.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      console.error("ZARINPAL_TRANSACTION_MISMATCH", {
        orderId: order.id,
        transactionExists: Boolean(transaction),
        transactionGateway: transaction?.gateway,
        transactionStatus: transaction?.status,
        amountMatches:
          transaction
            ? Number(transaction.amount) === Number(order.total)
            : false,
        authorityMatches:
          transaction?.authority === authority,
      });

      return redirectTo("/profile?payment=verify-error");
    }

    // انصراف کاربر از پرداخت در درگاه
    if (gatewayStatus === "NOK") {
      await prisma.transaction.updateMany({
        where: {
          orderId: order.id,
          authority,
          gateway: ZARINPAL_GATEWAY_NAME,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
        },
      });

      // بررسی callback هم‌زمان احتمالی
      const latestOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { paymentStatus: true },
      });

      if (latestOrder?.paymentStatus === "PAID") {
        return redirectTo("/profile?payment=success");
      }

      // سفارش حفظ می‌شود تا مشتری بتواند مجدداً پرداخت کند.
      return redirectTo("/profile?payment=canceled");
    }

    // وضعیت نامشخص را به‌عنوان انصراف قطعی ثبت نمی‌کنیم.
    if (gatewayStatus !== "OK") {
      console.error("ZARINPAL_UNKNOWN_CALLBACK_STATUS", {
        orderId: order.id,
        gatewayStatus,
      });

      return redirectTo("/profile?payment=verify-error");
    }

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;

    if (!merchantId) {
      console.error("ZARINPAL_MERCHANT_ID is missing");
      return redirectTo("/profile?payment=verify-error");
    }

    const amountRial = toZarinpalAmount(order.total);

    const response = await fetch(ZARINPAL_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        merchant_id: merchantId,
        authority,
        amount: amountRial,
      }),
    });

    const responseData = await response.json().catch(() => null);
    const result = responseData?.data;
    const code = Number(result?.code);

    // فقط کدهای 100 و 101 موفق محسوب می‌شوند.
    if (!response.ok || (code !== 100 && code !== 101)) {
      console.error("ZARINPAL_VERIFY_FAILED", {
        httpStatus: response.status,
        code: result?.code,
        errors: responseData?.errors,
        orderId: order.id,
      });

      // وضعیت را PENDING نگه می‌داریم؛ ممکن است پاسخ درگاه
      // به علت خطای موقت شبکه به سرور نرسیده باشد.
      return redirectTo("/profile?payment=verify-error");
    }

    const refId =
      result?.ref_id != null
        ? String(result.ref_id)
        : transaction.refId ?? order.refId ?? null;

    // ثبت اتمیک موفقیت پرداخت
    await prisma.$transaction(async (tx) => {
      // تراکنش باید هنوز PENDING و با همان Authority باشد.
      const transactionUpdate =
        await tx.transaction.updateMany({
          where: {
            orderId: order.id,
            authority,
            amount: order.total,
            gateway: ZARINPAL_GATEWAY_NAME,
            status: {
              in: ["PENDING", "FAILED"],
            },
          },
          data: {
            status: "SUCCESS",
            refId,
          },
        });

      if (transactionUpdate.count !== 1) {
        throw new Error(
          "Transaction state changed before payment confirmation",
        );
      }

      // فقط سفارش پرداخت‌نشده با همین Authority تغییر می‌کند.
      const orderUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          authority,
          paymentStatus: "PENDING",
        },
        data: {
          paymentStatus: "PAID",
          status: "PROCESSING",
          paidAt: order.paidAt ?? new Date(),
          refId,
        },
      });

      if (orderUpdate.count !== 1) {
        throw new Error(
          "Order state changed before payment confirmation",
        );
      }

      // حذف اقلام خریداری‌شده از سبد خرید
      const purchasedProductIds = order.items.map(
        (item) => item.productId,
      );

      if (purchasedProductIds.length) {
        await tx.cartItem.deleteMany({
          where: {
            userId: order.userId,
            productId: {
              in: purchasedProductIds,
            },
          },
        });
      }
    });

    return redirectTo("/profile?payment=success");
  } catch (error) {
    console.error("ZARINPAL_VERIFY_ERROR", {
      orderId,
      message: error?.message,
    });

    // ممکن است callback دیگری هم‌زمان پرداخت را ثبت کرده باشد.
    if (orderId !== null) {
      try {
        const latestOrder = await prisma.order.findUnique({
          where: { id: orderId },
          select: { paymentStatus: true },
        });

        if (latestOrder?.paymentStatus === "PAID") {
          return redirectTo("/profile?payment=success");
        }
      } catch (readError) {
        console.error(
          "ZARINPAL_ORDER_STATUS_CHECK_FAILED",
          readError,
        );
      }
    }

    return redirectTo("/profile?payment=verify-error");
  }
}
