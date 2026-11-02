
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  ZARINPAL_GATEWAY_NAME,
  ZARINPAL_IS_SANDBOX,
  ZARINPAL_REQUEST_URL,
  getZarinpalStartPayUrl,
  toZarinpalAmount,
} from "@/lib/zarinpal";

function errorResult(message, status) {
  return { error: message, status };
}

export async function POST(req) {
  try {
    const check = await requireAuth();

    if (check.error) return check.error;

    const body = await req.json().catch(() => ({}));
    const orderId = Number(body?.orderId);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "شناسه سفارش معتبر نیست" },
        { status: 400 },
      );
    }

    const merchantId = process.env.ZARINPAL_MERCHANT_ID;
    const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!merchantId || !rawSiteUrl) {
      return NextResponse.json(
        { error: "تنظیمات درگاه پرداخت کامل نیست" },
        { status: 500 },
      );
    }

    let siteUrl;

    try {
      const parsedUrl = new URL(rawSiteUrl);

      if (
        process.env.NODE_ENV === "production" &&
        parsedUrl.protocol !== "https:"
      ) {
        throw new Error("Production callback URL must use HTTPS");
      }

      siteUrl = parsedUrl.origin;
    } catch {
      return NextResponse.json(
        { error: "آدرس سایت برای بازگشت از درگاه معتبر نیست" },
        { status: 500 },
      );
    }

    const callbackUrl = `${siteUrl}/api/payment/verify`;

    const result = await prisma.$transaction(
      async (tx) => {
        // قفل ردیف سفارش تا پایان ساخت درخواست پرداخت.
        // درخواست هم‌زمان دیگر برای همین سفارش منتظر می‌ماند.
        const lockedRows = await tx.$queryRaw`
          SELECT "id"
          FROM "Order"
          WHERE "id" = ${orderId}
            AND "userId" = ${check.user.id}
          FOR UPDATE
        `;

        if (!lockedRows.length) {
          return errorResult("سفارش پیدا نشد", 404);
        }

        const order = await tx.order.findFirst({
          where: {
            id: orderId,
            userId: check.user.id,
          },
          include: {
            transaction: true,
          },
        });

        if (!order) {
          return errorResult("سفارش پیدا نشد", 404);
        }

        if (order.paymentStatus === "PAID") {
          return errorResult(
            "این سفارش قبلاً پرداخت شده است",
            409,
          );
        }

        if (order.paymentStatus !== "PENDING") {
          return errorResult(
            "وضعیت سفارش اجازه پرداخت نمی‌دهد؛ لطفاً سفارش جدید ثبت کنید",
            409,
          );
        }

        // تلاش‌های قدیمی Sandbox که با نام عمومی ZARINPAL ثبت شده‌اند.
        if (
          ZARINPAL_IS_SANDBOX &&
          order.transaction?.gateway === "ZARINPAL" &&
          order.transaction.status === "PENDING"
        ) {
          await tx.transaction.update({
            where: { orderId: order.id },
            data: { status: "FAILED" },
          });

          await tx.order.update({
            where: { id: order.id },
            data: { authority: null },
          });

          order.authority = null;
          order.transaction.status = "FAILED";
        }

        const transaction = order.transaction;

        // اگر تراکنش هنوز فعال است، فقط همان Authority معتبر را برمی‌گردانیم.
        if (transaction?.status === "PENDING") {
          const isConsistent =
            order.authority &&
            transaction.authority === order.authority &&
            transaction.gateway === ZARINPAL_GATEWAY_NAME &&
            Number(transaction.amount) === Number(order.total);

          if (!isConsistent) {
            console.error("ZARINPAL_ACTIVE_TRANSACTION_MISMATCH", {
              orderId: order.id,
              transactionGateway: transaction.gateway,
            });

            return errorResult(
              "برای این سفارش تلاش پرداخت فعالی با اطلاعات ناسازگار وجود دارد. لطفاً با پشتیبانی تماس بگیرید.",
              409,
            );
          }

          return {
            success: true,
            orderId: order.id,
            authority: order.authority,
            paymentUrl: getZarinpalStartPayUrl(order.authority),
            reused: true,
          };
        }

        if (transaction?.status === "SUCCESS") {
          return errorResult(
            "تراکنش قبلی موفق بوده اما وضعیت سفارش پرداخت‌شده نیست. لطفاً با پشتیبانی تماس بگیرید.",
            409,
          );
        }

        if (order.authority && !transaction) {
          return errorResult(
            "اطلاعات پرداخت سفارش ناقص است. لطفاً با پشتیبانی تماس بگیرید.",
            409,
          );
        }

        const amountRial = toZarinpalAmount(order.total);

        const response = await fetch(ZARINPAL_REQUEST_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: amountRial,
            callback_url: callbackUrl,
            description: `پرداخت سفارش شماره ${order.id}`,
            metadata: {
              mobile: order.receiverPhone,
            },
          }),
        });

        const responseData = await response.json().catch(() => null);
        const gatewayData = responseData?.data;

        if (
          !response.ok ||
          Number(gatewayData?.code) !== 100 ||
          !gatewayData?.authority
        ) {
          console.error("ZARINPAL_REQUEST_FAILED", {
            orderId: order.id,
            httpStatus: response.status,
            code: gatewayData?.code,
            errors: responseData?.errors,
          });

          return errorResult(
            "ایجاد درخواست پرداخت ناموفق بود؛ دوباره تلاش کنید",
            502,
          );
        }

        const authority = gatewayData.authority;

        // ذخیره Authority و تراکنش در یک تراکنش دیتابیس
        await tx.order.update({
          where: { id: order.id },
          data: { authority },
        });

        await tx.transaction.upsert({
          where: { orderId: order.id },
          create: {
            orderId: order.id,
            authority,
            amount: order.total,
            status: "PENDING",
            gateway: ZARINPAL_GATEWAY_NAME,
          },
          update: {
            authority,
            refId: null,
            amount: order.total,
            status: "PENDING",
            gateway: ZARINPAL_GATEWAY_NAME,
          },
        });

        return {
          success: true,
          orderId: order.id,
          authority,
          paymentUrl: getZarinpalStartPayUrl(authority),
          reused: false,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      },
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("ZARINPAL_REQUEST_ERROR", {
      message: error?.message,
    });

    return NextResponse.json(
      { error: "خطا در اتصال به درگاه پرداخت" },
      { status: 500 },
    );
  }
}
