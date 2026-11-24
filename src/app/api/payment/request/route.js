import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  ZARINPAL_GATEWAY_NAME,
  ZARINPAL_IS_SANDBOX,
  ZARINPAL_REQUEST_URL,
  assertGatewayConfig,
  getZarinpalStartPayUrl,
  toZarinpalAmount,
} from "@/lib/zarinpal";
import {
  calculateZarinpalPaymentAmount,
  ZarinpalFeeError,
} from "@/lib/zarinpal-fee";
import {
  reserveOrderStock,
  releaseOrderStock,
  StockUnavailableError,
  findPriceMismatches,
} from "@/lib/stock-reservation";
import { reconcileExpiredOrders } from "@/lib/payment-recon";

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

/**
 * بازسازی مبلغ موردنیاز سفارش از Snapshot اقلام.
 *
 * مبلغ موردنیاز:
 * مجموع قیمت اقلام + هزینه ارسال - تخفیف فروشگاه
 *
 * مبلغ نهایی:
 * مبلغ موردنیاز + کارمزد درگاه
 *
 * این تابع مانع پرداخت سفارش‌هایی می‌شود که total و
 * gatewayFee آن‌ها با اطلاعات مالی ذخیره‌شده هماهنگ نیست.
 */

function getOrderPaymentBreakdown(order) {
  if (!Array.isArray(order?.items) || !order.items.length) {
    return null;
  }

  let itemsSubtotal = 0;

  for (const item of order.items) {
    const price = Number(item.price);
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return null;
    }

    const lineTotal = price * quantity;

    if (
      !Number.isSafeInteger(lineTotal) ||
      !Number.isSafeInteger(itemsSubtotal + lineTotal)
    ) {
      return null;
    }

    itemsSubtotal += lineTotal;
  }

  const shippingCost = Number(order.shippingCost ?? 0);
  const couponDiscount = Number(order.couponDiscount ?? 0);
  const couponShippingDiscount = Number(
    order.couponShippingDiscount ?? 0
  );
  const gatewayFee = Number(order.gatewayFee ?? 0);
  const total = Number(order.total);

  if (
    !Number.isSafeInteger(shippingCost) ||
    shippingCost < 0 ||
    !Number.isSafeInteger(couponDiscount) ||
    couponDiscount < 0 ||
    couponDiscount > itemsSubtotal ||
    !Number.isSafeInteger(couponShippingDiscount) ||
    couponShippingDiscount < 0 ||
    couponShippingDiscount > shippingCost ||
    !Number.isSafeInteger(gatewayFee) ||
    gatewayFee < 0 ||
    !Number.isSafeInteger(total) ||
    total <= 0
  ) {
    return null;
  }

  const couponCode =
    typeof order.couponCode === "string" &&
    order.couponCode.trim()
      ? order.couponCode.trim()
      : null;

  const couponType = order.couponType ?? null;

  // اعتبارسنجی سازگاری Snapshot کوپن
  if (couponType === null) {
    if (
      couponCode !== null ||
      couponDiscount !== 0 ||
      couponShippingDiscount !== 0
    ) {
      return null;
    }
  } else {
    if (!couponCode) return null;

    if (couponType === "FREE_SHIPPING") {
      if (
        couponDiscount !== 0 ||
        couponShippingDiscount !== shippingCost ||
        shippingCost <= 0
      ) {
        return null;
      }
    } else if (
      couponType === "PERCENTAGE" ||
      couponType === "FIXED"
    ) {
      if (
        couponDiscount <= 0 ||
        couponShippingDiscount !== 0
      ) {
        return null;
      }
    } else {
      return null;
    }
  }

  // مبلغ کالاها + ارسال - تخفیف کالا - تخفیف ارسال
  const requiredAmount =
    itemsSubtotal +
    shippingCost -
    couponDiscount -
    couponShippingDiscount;

  if (
    !Number.isSafeInteger(requiredAmount) ||
    requiredAmount <= 0 ||
    requiredAmount > 2_147_483_647 ||
    !Number.isSafeInteger(requiredAmount + gatewayFee) ||
    total !== requiredAmount + gatewayFee
  ) {
    return null;
  }

  return {
    itemsSubtotal,
    shippingCost,
    couponDiscount,
    couponShippingDiscount,
    requiredAmount,
    gatewayFee,
    total,
  };
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

function normalizeFeeType(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toUpperCase();

  return ["MERCHANT", "PAYER"].includes(normalized)
    ? normalized
    : null;
}

export async function POST(req) {
  try {
    const check = await requireAuth();

    if (check.error) return check.error;

    try {
      assertGatewayConfig();
    } catch (error) {
      console.error("ZARINPAL_CONFIG_ERROR", error?.code);

      return NextResponse.json(
        { error: "تنظیمات درگاه پرداخت معتبر نیست" },
        { status: 503 },
      );
    }

    // آزادسازی رزروهای منقضی‌شده کاربر
    await reconcileExpiredOrders({
      limit: 3,
      userId: check.user.id,
    }).catch(() => {});

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
        throw new Error(
          "Production callback URL must use HTTPS"
        );
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
     * قفل کاربر و سفارش، اعتبارسنجی مبلغ و رزرو موجودی.
     *
     * درخواست شبکه‌ای زرین‌پال داخل تراکنش اجرا نمی‌شود.
     */

    const reservationResult = await prisma.$transaction(
      async (tx) => {
        // قفل کاربر برای جلوگیری از رزرو هم‌زمان چند سفارش
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

        if (order.stockReservationStatus === "ISSUE") {
          return errorResult(
            "سفارش نیازمند بررسی پشتیبانی است",
            409,
          );
        }

        // اعتبارسنجی مبلغ ذخیره‌شده در سفارش
        const paymentBreakdown =
          getOrderPaymentBreakdown(order);

        if (!paymentBreakdown) {
          console.error("ORDER_PAYMENT_AMOUNT_MISMATCH", {
            orderId: order.id,
          });

          return errorResult(
            "مبلغ سفارش با جزئیات مالی آن هماهنگ نیست. لطفاً سفارش را دوباره ثبت کنید.",
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

          // سازگاری با تراکنش‌های فعال قدیمی
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
        // پرداختی باشد که هنگام ارتباط با درگاه متوقف شده است.
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

        // Authority قدیمی پاک می‌شود تا callback نامعتبر
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

        // بررسی قیمت محصولات با Snapshot سفارش
        const priceMismatches = await findPriceMismatches(
          tx,
          order
        );

        if (priceMismatches.length > 0) {
          return errorResult(
            "قیمت برخی کالاهای این سفارش تغییر کرده است. لطفاً سبد خرید را بررسی و سفارش را دوباره ثبت کنید.",
            409,
          );
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
          amount: paymentBreakdown.total,
          requiredAmount: paymentBreakdown.requiredAmount,
          gatewayFee: paymentBreakdown.gatewayFee,
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
        {
          error: reservationResult.error,
        },
        {
          status: reservationResult.status,
        },
      );
    }

    // سفارش دارای تراکنش فعال، همان Authority قبلی را استفاده می‌کند.
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
     * اعتبارسنجی مجدد کارمزد پیش از ایجاد درخواست درگاه.
     *
     * اگر کارمزد تغییر کرده باشد، سفارش با مبلغ جدید و پنهانی
     * شارژ نمی‌شود؛ رزرو آزاد و پرداخت متوقف می‌شود.
     */

    const {
      orderId: reservedOrderId,
      userId,
      amount,
      requiredAmount,
      gatewayFee,
      receiverPhone,
      expiresAt,
    } = reservationResult;

    let paymentQuote;

    try {
      paymentQuote =
        await calculateZarinpalPaymentAmount(
          requiredAmount
        );
    } catch (feeError) {
      console.error("ZARINPAL_FEE_RECHECK_ERROR", {
        orderId: reservedOrderId,
        code: feeError?.code,
        message: feeError?.message,
      });

      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        {
          error:
            feeError instanceof ZarinpalFeeError
              ? feeError.message
              : "استعلام مجدد کارمزد زرین‌پال ناموفق بود.",
        },
        { status: 503 },
      );
    }

    // مبلغ استعلام‌شده باید دقیقاً با مبلغ ثبت‌شده در سفارش برابر باشد.
    if (
      paymentQuote.totalAmountToman !== amount ||
      paymentQuote.gatewayFeeToman !== gatewayFee
    ) {
      console.warn("ZARINPAL_FEE_QUOTE_CHANGED", {
        orderId: reservedOrderId,
        storedAmount: amount,
        quotedAmount: paymentQuote.totalAmountToman,
        storedFee: gatewayFee,
        quotedFee: paymentQuote.gatewayFeeToman,
      });

      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        {
          error:
            "کارمزد درگاه نسبت به پیش‌فاکتور تغییر کرده است. لطفاً Checkout را تازه‌سازی و پیش‌فاکتور جدید دریافت کنید.",
        },
        { status: 409 },
      );
    }

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

    if (
      !Number.isSafeInteger(amountRial) ||
      amountRial <= 0 ||
      paymentQuote.amountRial !== amountRial
    ) {
      await releaseUnlinkedReservation({
        orderId: reservedOrderId,
        userId,
        expiresAt,
      });

      return NextResponse.json(
        {
          error:
            "مبلغ ریالی سفارش با پیش‌فاکتور زرین‌پال هماهنگ نیست.",
        },
        { status: 409 },
      );
    }

    /*
     * مرحله سوم:
     * ایجاد درخواست پرداخت خارج از تراکنش دیتابیس.
     *
     * در این مرحله موجودی قبلاً رزرو شده است.
     */

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

    // در صورت بازگشت نوع کارمزد از درخواست پرداخت،
    // باید با نوع کارمزد استعلام‌شده هماهنگ باشد.
    if (gatewayData?.fee_type != null) {
      const actualFeeType = normalizeFeeType(
        gatewayData.fee_type
      );

      if (
        !actualFeeType ||
        actualFeeType !== paymentQuote.feeType
      ) {
        console.error("ZARINPAL_FEE_TYPE_MISMATCH", {
          orderId: reservedOrderId,
          quotedFeeType: paymentQuote.feeType,
          returnedFeeType: gatewayData.fee_type,
        });

        await releaseUnlinkedReservation({
          orderId: reservedOrderId,
          userId,
          expiresAt,
          issuedAuthority: authority,
        });

        return NextResponse.json(
          {
            error:
              "نوع کارمزد اعلام‌شده توسط درگاه با پیش‌فاکتور هماهنگ نیست. پرداخت متوقف شد.",
          },
          { status: 502 },
        );
      }
    }

    /*
     * مرحله چهارم:
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
            items: true,
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

        const latestBreakdown =
          getOrderPaymentBreakdown(latestOrder);

        if (
          !latestBreakdown ||
          latestBreakdown.total !== amount ||
          latestBreakdown.requiredAmount !== requiredAmount ||
          latestBreakdown.gatewayFee !== gatewayFee
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

        await tx.paymentAttempt.upsert({
          where: {
            authority,
          },
          create: {
            orderId: reservedOrderId,
            userId: check.user.id,
            authority,
            amount,
            gateway: ZARINPAL_GATEWAY_NAME,
            status: "PENDING",
          },
          update: {},
        });

        return true;
      });
    } catch (saveError) {
      console.error("ZARINPAL_AUTHORITY_SAVE_ERROR", {
        orderId: reservedOrderId,
        message: saveError?.message,
      });

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

    if (error instanceof ZarinpalFeeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ایجاد درخواست پرداخت" },
      { status: 500 },
    );
  }
}