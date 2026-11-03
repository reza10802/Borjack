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
import {
  reserveOrderStock,
  releaseOrderStock,
  StockUnavailableError,
} from "@/lib/stock-reservation";

const RESERVATION_DURATION_MS = 15 * 60 * 1000;

function errorResult(message, status) {
  return { type: "ERROR", error: message, status };
}

function isSameDate(a, b) {
  return (
    a instanceof Date &&
    b instanceof Date &&
    a.getTime() === b.getTime()
  );
}

// آزادسازی فقط زمانی مجاز است که Authority به کاربر تحویل نشده باشد
// و سفارش همچنان متعلق به همین تلاش رزرو باشد.
async function releaseUnlinkedReservation({
  orderId,
  userId,
  expiresAt,
  issuedAuthority = null,
}) {
  await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw`
      SELECT "id"
      FROM "Order"
      WHERE "id" = ${orderId}
        AND "userId" = ${userId}
      FOR UPDATE
    `;

    if (!lockedRows.length) return;

    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        transaction: true,
        items: true,
      },
    });

    if (
      !order ||
      order.paymentStatus !== "PENDING" ||
      order.stockReservationStatus !== "RESERVED" ||
      order.authority !== null ||
      !isSameDate(order.paymentExpiresAt, expiresAt)
    ) {
      return;
    }

    // اگر Authority در دیتابیس ثبت شده باشد، رزرو نباید آزاد شود.
    if (
      issuedAuthority &&
      order.transaction?.authority === issuedAuthority
    ) {
      return;
    }

    // تراکنش فعال یا موفق را بدون استعلام درگاه آزاد نمی‌کنیم.
    if (
      order.transaction?.status === "PENDING" ||
      order.transaction?.status === "SUCCESS"
    ) {
      return;
    }

    await releaseOrderStock(tx, order);
  });
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

    /*
     * مرحله اول:
     * قفل کاربر و سفارش، بررسی رزرو فعال و رزرو موجودی.
     *
     * درخواست شبکه‌ای زرین‌پال در این تراکنش اجرا نمی‌شود.
     */

    const reservationResult = await prisma.$transaction(
      async (tx) => {
        // قفل کاربر برای جلوگیری از رزرو هم‌زمان چند سفارش
        // توسط یک حساب کاربری.
        const userRows = await tx.$queryRaw`
          SELECT "id"
          FROM "User"
          WHERE "id" = ${check.user.id}
          FOR UPDATE
        `;

        if (!userRows.length) {
          return errorResult("کاربر پیدا نشد", 404);
        }

        // قفل سفارش
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
            items: true,
          },
        });

        if (!order) {
          return errorResult("سفارش پیدا نشد", 404);
        }

        if (
          order.paymentStatus === "PAID" ||
          order.stockReservationStatus === "CONSUMED"
        ) {
          return errorResult(
            "این سفارش قبلاً پرداخت شده است",
            409,
          );
        }

        if (
          order.paymentStatus !== "PENDING" ||
          order.status !== "PENDING"
        ) {
          return errorResult(
            "وضعیت سفارش اجازه پرداخت نمی‌دهد",
            409,
          );
        }

        if (
          order.stockReservationStatus === "ISSUE"
        ) {
          return errorResult(
            "سفارش نیازمند بررسی پشتیبانی است",
            409,
          );
        }

        // حداکثر یک رزرو فعال برای هر کاربر
        const anotherReservation = await tx.order.findFirst({
          where: {
            userId: check.user.id,
            id: { not: order.id },
            stockReservationStatus: "RESERVED",
          },
          select: {
            id: true,
            paymentExpiresAt: true,
          },
        });

        if (anotherReservation) {
          return errorResult(
            "شما یک سفارش با رزرو موجودی فعال دارید. ابتدا وضعیت پرداخت قبلی را مشخص کنید.",
            409,
          );
        }

        let transaction = order.transaction;
        let reservationStatus = order.stockReservationStatus;

        // سازگاری با تراکنش‌های قدیمی Sandbox
        if (
          ZARINPAL_IS_SANDBOX &&
          transaction?.gateway === "ZARINPAL" &&
          transaction.status === "PENDING"
        ) {
          if (reservationStatus === "RESERVED") {
            await releaseOrderStock(tx, order);
            reservationStatus = "RELEASED";
          }

          await tx.transaction.update({
            where: {
              orderId: order.id,
            },
            data: {
              status: "FAILED",
            },
          });

          await tx.order.update({
            where: {
              id: order.id,
            },
            data: {
              authority: null,
            },
          });

          transaction = {
            ...transaction,
            status: "FAILED",
          };
        }

        // رزرو باید همیشه با وضعیت تراکنش سازگار باشد.
        if (transaction?.status === "PENDING") {
          const isConsistent =
            order.authority &&
            transaction.authority === order.authority &&
            transaction.gateway === ZARINPAL_GATEWAY_NAME &&
            Number(transaction.amount) === Number(order.total);

          if (!isConsistent) {
            console.error(
              "ZARINPAL_ACTIVE_TRANSACTION_MISMATCH",
              {
                orderId: order.id,
                transactionGateway: transaction.gateway,
              },
            );

            return errorResult(
              "اطلاعات پرداخت سفارش ناسازگار است. لطفاً با پشتیبانی تماس بگیرید.",
              409,
            );
          }

          // رزرو فعال: Authority قبلی استفاده می‌شود.
          // زمان رزرو در درخواست تکراری تمدید نمی‌شود.
          if (reservationStatus === "RESERVED") {
            if (
              !order.paymentExpiresAt ||
              order.paymentExpiresAt <= new Date()
            ) {
              return errorResult(
                "مهلت رزرو پرداخت به پایان رسیده و وضعیت آن در حال بررسی است.",
                409,
              );
            }

            return {
              type: "REUSE",
              orderId: order.id,
              authority: order.authority,
            };
          }

          // سفارش‌های در حال پرداخت قبل از اضافه‌شدن سیستم رزرو
          // ممکن است تراکنش فعال ولی وضعیت NONE داشته باشند.
          if (reservationStatus === "NONE") {
            const expiresAt = new Date(
              Date.now() + RESERVATION_DURATION_MS,
            );

            await reserveOrderStock(tx, order, expiresAt);

            return {
              type: "REUSE",
              orderId: order.id,
              authority: order.authority,
            };
          }

          return errorResult(
            "وضعیت رزرو این سفارش با پرداخت فعال آن سازگار نیست.",
            409,
          );
        }

        if (transaction?.status === "SUCCESS") {
          return errorResult(
            "تراکنش قبلی موفق بوده اما وضعیت سفارش کامل نیست. لطفاً با پشتیبانی تماس بگیرید.",
            409,
          );
        }

        // اگر تراکنش قبلی ناموفق بوده، رزرو آن آزاد می‌شود.
        if (
          transaction?.status === "FAILED" &&
          reservationStatus === "RESERVED"
        ) {
          await releaseOrderStock(tx, order);
          reservationStatus = "RELEASED";
        }

        if (
          reservationStatus === "CONSUMED" ||
          reservationStatus === "ISSUE"
        ) {
          return errorResult(
            "وضعیت موجودی سفارش نیازمند بررسی است",
            409,
          );
        }

        // رزروی که Authority ندارد ممکن است متعلق به درخواست
        // پرداختی باشد که سرور هنگام ارتباط با درگاه متوقف شده است.
        if (
          reservationStatus === "RESERVED" &&
          !transaction
        ) {
          if (order.authority) {
            return errorResult(
              "اطلاعات رزرو و پرداخت سفارش ناقص است. لطفاً با پشتیبانی تماس بگیرید.",
              409,
            );
          }

          if (
            order.paymentExpiresAt &&
            order.paymentExpiresAt <= new Date()
          ) {
            await releaseOrderStock(tx, order);
            reservationStatus = "RELEASED";
          } else {
            return errorResult(
              "درخواست پرداخت قبلی هنوز در حال آماده‌سازی است. کمی بعد دوباره تلاش کنید.",
              409,
            );
          }
        }

        // Authority بدون تراکنش را بازنویسی نمی‌کنیم.
        if (order.authority && !transaction) {
          return errorResult(
            "اطلاعات پرداخت سفارش ناقص است. لطفاً با پشتیبانی تماس بگیرید.",
            409,
          );
        }

        // ثبت Authority قدیمی پاک می‌شود تا callback نامعتبر
        // نتواند به سفارش جدید متصل شود.
        if (
          transaction?.status === "FAILED" &&
          order.authority
        ) {
          await tx.order.update({
            where: {
              id: order.id,
            },
            data: {
              authority: null,
            },
          });
        }

        const expiresAt = new Date(
          Date.now() + RESERVATION_DURATION_MS,
        );

        // رزرو اتمیک همه اقلام سفارش
        await reserveOrderStock(
          tx,
          {
            ...order,
            stockReservationStatus: reservationStatus,
            items: order.items,
          },
          expiresAt,
        );

        return {
          type: "CREATE",
          orderId: order.id,
          userId: check.user.id,
          amount: order.total,
          receiverPhone: order.receiverPhone,
          expiresAt,
        };
      },
      {
        maxWait: 10000,
        timeout: 15000,
      },
    );

    if (reservationResult.type === "ERROR") {
      return NextResponse.json(
        { error: reservationResult.error },
        { status: reservationResult.status },
      );
    }

    // سفارش دارای تراکنش فعال، همان Authority را استفاده می‌کند.
    if (reservationResult.type === "REUSE") {
      return NextResponse.json({
        success: true,
        orderId: reservationResult.orderId,
        authority: reservationResult.authority,
        paymentUrl: getZarinpalStartPayUrl(
          reservationResult.authority,
        ),
        reused: true,
      });
    }

    /*
     * مرحله دوم:
     * ایجاد درخواست پرداخت خارج از تراکنش دیتابیس.
     *
     * در این مرحله موجودی قبلاً رزرو شده است.
     */

    const {
      orderId: reservedOrderId,
      userId,
      amount,
      receiverPhone,
      expiresAt,
    } = reservationResult;

    let amountRial;

    try {
      amountRial = toZarinpalAmount(amount);
    } catch {
      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        { error: "مبلغ سفارش معتبر نیست" },
        { status: 400 },
      );
    }

    let response;
    let responseData;

    try {
      response = await fetch(ZARINPAL_REQUEST_URL, {
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
          description: `پرداخت سفارش شماره ${reservedOrderId}`,
          metadata: {
            mobile: receiverPhone,
          },
        }),
      });

      responseData = await response.json().catch(() => null);
    } catch (gatewayError) {
      console.error("ZARINPAL_REQUEST_NETWORK_ERROR", {
        orderId: reservedOrderId,
        message: gatewayError?.message,
      });

      // چون Authority دریافت نشده و لینک پرداختی به مشتری
      // ارائه نشده، رزرو این تلاش را آزاد می‌کنیم.
      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        {
          error:
            "ارتباط با درگاه برقرار نشد. موجودی رزروشده آزاد شد؛ دوباره تلاش کنید.",
        },
        { status: 502 },
      );
    }

    const gatewayData = responseData?.data;
    const authority = gatewayData?.authority;

    if (
      !response.ok ||
      Number(gatewayData?.code) !== 100 ||
      typeof authority !== "string" ||
      !authority.trim() ||
      authority.length > 100
    ) {
      console.error("ZARINPAL_REQUEST_FAILED", {
        orderId: reservedOrderId,
        httpStatus: response.status,
        code: gatewayData?.code,
        errors: responseData?.errors,
      });

      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        {
          error:
            "ایجاد درخواست پرداخت ناموفق بود. رزرو موجودی آزاد شد؛ دوباره تلاش کنید.",
        },
        { status: 502 },
      );
    }

    /*
     * مرحله سوم:
     * ذخیره Authority و تراکنش.
     *
     * Authority فقط در صورتی ثبت می‌شود که رزرو هنوز فعال باشد.
     */

    let persisted = false;

    try {
      persisted = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "User"
          WHERE "id" = ${userId}
          FOR UPDATE
        `;

        const lockedRows = await tx.$queryRaw`
          SELECT "id"
          FROM "Order"
          WHERE "id" = ${reservedOrderId}
            AND "userId" = ${userId}
          FOR UPDATE
        `;

        if (!lockedRows.length) {
          return false;
        }

        const latestOrder = await tx.order.findFirst({
          where: {
            id: reservedOrderId,
            userId,
          },
          include: {
            transaction: true,
          },
        });

        if (
          !latestOrder ||
          latestOrder.paymentStatus !== "PENDING" ||
          latestOrder.status !== "PENDING" ||
          latestOrder.stockReservationStatus !== "RESERVED" ||
          latestOrder.authority !== null ||
          !isSameDate(latestOrder.paymentExpiresAt, expiresAt) ||
          latestOrder.paymentExpiresAt <= new Date()
        ) {
          return false;
        }

        if (
          latestOrder.transaction?.status === "PENDING" ||
          latestOrder.transaction?.status === "SUCCESS"
        ) {
          return false;
        }

        await tx.order.update({
          where: {
            id: reservedOrderId,
          },
          data: {
            authority,
          },
        });

        await tx.transaction.upsert({
          where: {
            orderId: reservedOrderId,
          },
          create: {
            orderId: reservedOrderId,
            authority,
            amount,
            status: "PENDING",
            gateway: ZARINPAL_GATEWAY_NAME,
          },
          update: {
            authority,
            refId: null,
            amount,
            status: "PENDING",
            gateway: ZARINPAL_GATEWAY_NAME,
          },
        });

        return true;
      });
    } catch (saveError) {
      console.error("ZARINPAL_AUTHORITY_SAVE_ERROR", {
        orderId: reservedOrderId,
        message: saveError?.message,
      });

      // اگر ذخیره Authority با موفقیت Commit شده باشد،
      // تابع آزادسازی آن را تشخیص می‌دهد و دست نمی‌زند.
      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
        issuedAuthority: authority,
      });

      return NextResponse.json(
        {
          error:
            "در ثبت اطلاعات پرداخت مشکلی رخ داد. وضعیت رزرو برای جلوگیری از فروش مجدد بررسی می‌شود.",
        },
        { status: 500 },
      );
    }

    if (!persisted) {
      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
        issuedAuthority: authority,
      });

      return NextResponse.json(
        {
          error:
            "وضعیت سفارش هنگام ایجاد پرداخت تغییر کرد. لطفاً دوباره وضعیت سفارش را بررسی کنید.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: reservedOrderId,
      authority,
      paymentUrl: getZarinpalStartPayUrl(authority),
      reused: false,
      reservationExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error("ZARINPAL_REQUEST_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    if (
      error instanceof StockUnavailableError ||
      error?.code === "STOCK_UNAVAILABLE"
    ) {
      return NextResponse.json(
        {
          error:
            "موجودی کافی نیست یا در همین لحظه توسط مشتری دیگری رزرو شده است. لطفاً سبد خرید خود را بررسی کنید.",
          productId: error.productId,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ایجاد درخواست پرداخت" },
      { status: 500 },
    );
  }
}