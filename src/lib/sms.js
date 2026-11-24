import { maskPhone } from "@/lib/security";
import { prisma } from "@/lib/db";

const SMS_IR_VERIFY_URL = "https://api.sms.ir/v1/send/verify";
const SMS_TIMEOUT_MS = 10000;
const DEFAULT_ORDER_TEMPLATE_ID = 471482;

export class SmsError extends Error {
  constructor(code, detail) {
    super(code);
    this.name = "SmsError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * ارسال قالب Verify در SMS.ir
 */
async function sendVerifyTemplate({
  phone,
  templateId,
  parameters,
}) {
  const apiKey = process.env.SMS_IR_API_KEY?.trim();

  if (!apiKey) {
    throw new SmsError("SMS_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    SMS_TIMEOUT_MS,
  );

  try {
    const res = await fetch(SMS_IR_VERIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        mobile: phone,
        templateId: Number(templateId),
        parameters,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    let result = null;
    let responseParsed = false;

    try {
      result = await res.json();
      responseParsed =
        result !== null && typeof result === "object";
    } catch {
      // پاسخ نامعتبر در تابع فراخواننده مدیریت می‌شود.
    }

    return {
      httpStatus: res.status,
      httpOk: res.ok,
      result,
      responseParsed,
    };
  } catch (error) {
    if (error instanceof SmsError) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw new SmsError("SMS_TIMEOUT");
    }

    throw new SmsError("SMS_NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * ارسال پیامک OTP
 * رفتار قبلی سرویس حفظ شده است.
 */
export async function sendOtpSms(phone, code, purpose) {
  const templateId =
    purpose === "VERIFY_PHONE"
      ? process.env.SMS_IR_VERIFY_TEMPLATE_ID
      : purpose === "RESET_PASSWORD"
        ? process.env.SMS_IR_RESET_PASSWORD_TEMPLATE_ID
        : purpose === "LOGIN"
          ? process.env.SMS_IR_LOGIN_TEMPLATE_ID ||
            process.env.SMS_IR_VERIFY_TEMPLATE_ID
          : null;

  if (!templateId) {
    throw new SmsError("SMS_TEMPLATE_MISSING");
  }

  try {
    const response = await sendVerifyTemplate({
      phone,
      templateId,
      parameters: [
        {
          name: "Code",
          value: String(code),
        },
      ],
    });

    if (!response.httpOk) {
      console.error("SMS_IR_FAILED", {
        status: response.httpStatus,
        purpose,
        phone: maskPhone(phone),
      });

      throw new SmsError(
        "SMS_PROVIDER_ERROR",
        `status ${response.httpStatus}`,
      );
    }

    return true;
  } catch (error) {
    if (error instanceof SmsError) {
      if (
        error.code === "SMS_NETWORK_ERROR" ||
        error.code === "SMS_TIMEOUT"
      ) {
        console.error("SMS_IR_NETWORK_ERROR", {
          purpose,
          phone: maskPhone(phone),
          code: error.code,
        });
      }

      throw error;
    }

    console.error("SMS_IR_UNEXPECTED_ERROR", {
      purpose,
      phone: maskPhone(phone),
      name: error?.name,
    });

    throw new SmsError("SMS_NETWORK_ERROR");
  }
}

/**
 * تبدیل شماره موبایل به قالب استاندارد ایران
 */
function normalizeIranMobile(value) {
  const digits = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
    )
    .replace(/\D/g, "");

  if (/^09\d{9}$/.test(digits)) {
    return digits;
  }

  if (/^9\d{9}$/.test(digits)) {
    return `0${digits}`;
  }

  if (/^989\d{9}$/.test(digits)) {
    return `0${digits.slice(2)}`;
  }

  if (/^00989\d{9}$/.test(digits)) {
    return `0${digits.slice(4)}`;
  }

  return null;
}

/**
 * دریافت و اعتبارسنجی شماره موبایل ادمین‌ها
 *
 * فرمت تنظیمات:
 * ADMIN_ORDER_SMS_MOBILES=0912...,0935...,0990...
 */
function getAdminOrderSmsMobiles() {
  const raw = process.env.ADMIN_ORDER_SMS_MOBILES || "";

  const entries = raw
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const validMobiles = [];
  let invalidCount = 0;

  for (const entry of entries) {
    const mobile = normalizeIranMobile(entry);

    if (!mobile) {
      invalidCount++;
      continue;
    }

    validMobiles.push(mobile);
  }

  return {
    mobiles: [...new Set(validMobiles)],
    invalidCount,
    configuredCount: entries.length,
  };
}

/**
 * ساخت پارامترهای قالب SMS.ir
 * حداکثر طول هر مقدار ۲۵ کاراکتر است.
 */
function makeSmsParameter(name, value) {
  const text = String(value);

  if (!text || text.length > 25) {
    throw new SmsError("SMS_INVALID_PARAMETER");
  }

  return {
    name,
    value: text,
  };
}

/**
 * تغییر وضعیت یک گیرنده
 * فقط رکوردی که در وضعیت SENDING است تغییر می‌کند.
 */
async function updateRecipientStatus(
  recipientId,
  status,
  extra = {},
) {
  return prisma.adminOrderSmsRecipient.updateMany({
    where: {
      id: recipientId,
      status: "SENDING",
    },
    data: {
      status,
      ...extra,
    },
  });
}

/**
 * ارسال پیامک سفارش برای یک گیرنده
 */
async function sendToOneAdmin(recipient, templateId, parameters) {
  // Claim اتمیک برای جلوگیری از ارسال هم‌زمان تکراری
  const claim = await prisma.adminOrderSmsRecipient.updateMany({
    where: {
      id: recipient.id,
      status: "PENDING",
    },
    data: {
      status: "SENDING",
      attemptedAt: new Date(),
      attempts: {
        increment: 1,
      },
      error: null,
    },
  });

  if (claim.count !== 1) {
    return {
      status: "SKIPPED",
    };
  }

  let response;

  try {
    response = await sendVerifyTemplate({
      phone: recipient.mobile,
      templateId,
      parameters,
    });
  } catch (error) {
    const updated = await updateRecipientStatus(
      recipient.id,
      "UNKNOWN",
      {
        error:
          error.code === "SMS_TIMEOUT"
            ? "SMS_TIMEOUT_RESULT_UNKNOWN"
            : "SMS_NETWORK_RESULT_UNKNOWN",
      },
    );

    if (updated.count !== 1) {
      console.error(
        "ADMIN_ORDER_SMS_STATUS_UPDATE_FAILED",
        {
          recipientId: recipient.id,
        },
      );
    }

    console.error("ADMIN_ORDER_SMS_NETWORK_ERROR", {
      orderId: recipient.orderId,
      adminPhone: maskPhone(recipient.mobile),
      code: error.code || "UNKNOWN",
    });

    return {
      status: "UNKNOWN",
    };
  }

  // تأیید موفقیت واقعی توسط پاسخ SMS.ir
  if (
    response.httpOk &&
    response.responseParsed &&
    Number(response.result?.status) === 1
  ) {
    const messageId = response.result?.data?.messageId;

    const updated = await updateRecipientStatus(
      recipient.id,
      "SENT",
      {
        sentAt: new Date(),
        messageId:
          messageId !== undefined && messageId !== null
            ? String(messageId)
            : null,
        error: null,
      },
    );

    if (updated.count !== 1) {
      // درخواست احتمالاً ارسال شده؛ ارسال مجدد ممنوع است.
      console.error("ADMIN_ORDER_SMS_SENT_STATUS_NOT_SAVED", {
        orderId: recipient.orderId,
        recipientId: recipient.id,
      });

      return {
        status: "UNKNOWN",
      };
    }

    console.info("ADMIN_ORDER_SMS_SENT", {
      orderId: recipient.orderId,
      adminPhone: maskPhone(recipient.mobile),
      messageId:
        messageId !== undefined && messageId !== null
          ? String(messageId)
          : null,
    });

    return {
      status: "SENT",
    };
  }

  // پاسخ 4xx یا پاسخ معتبر با status ناموفق یعنی درخواست رد شده است.
  // پاسخ 5xx یا پاسخ غیرقابل‌خواندن نتیجه نامشخص محسوب می‌شود.
  const definitivelyFailed =
    (
      response.httpStatus >= 400 &&
      response.httpStatus < 500
    ) ||
    (
      response.httpOk &&
      response.responseParsed &&
      Number(response.result?.status) !== 1
    );

  const finalStatus = definitivelyFailed
    ? "FAILED"
    : "UNKNOWN";

  const errorCode = response.responseParsed
    ? `SMS_IR_PROVIDER_STATUS_${response.result?.status ?? "UNKNOWN"}`
    : `SMS_IR_HTTP_${response.httpStatus}`;

  const updated = await updateRecipientStatus(
    recipient.id,
    finalStatus,
    {
      error: errorCode,
    },
  );

  if (updated.count !== 1) {
    console.error("ADMIN_ORDER_SMS_STATUS_UPDATE_FAILED", {
      orderId: recipient.orderId,
      recipientId: recipient.id,
    });
  }

  console.error("ADMIN_ORDER_SMS_PROVIDER_ERROR", {
    orderId: recipient.orderId,
    adminPhone: maskPhone(recipient.mobile),
    httpStatus: response.httpStatus,
    providerStatus: response.result?.status ?? null,
    status: finalStatus,
  });

  return {
    status: finalStatus,
  };
}

/**
 * اطلاع‌رسانی سفارش پرداخت‌شده به تمام ادمین‌ها
 *
 * برای هر سفارش و هر شماره یک رکورد مستقل ایجاد می‌شود.
 * ارسال پیامک به یک ادمین مانع ارسال به ادمین‌های دیگر نمی‌شود.
 *
 * این تابع خطای پیامک را به پرداخت مشتری منتقل نمی‌کند.
 */
export async function sendAdminOrderNotificationSms(orderId) {
  try {
    if (process.env.SMS_IR_ORDER_ENABLED !== "true") {
      return {
        success: false,
        status: "DISABLED",
      };
    }

    const apiKey = process.env.SMS_IR_API_KEY?.trim();

    const {
      mobiles,
      invalidCount,
      configuredCount,
    } = getAdminOrderSmsMobiles();

    const templateId = Number(
      process.env.SMS_IR_ORDER_TEMPLATE_ID ||
        DEFAULT_ORDER_TEMPLATE_ID,
    );

    if (
      !apiKey ||
      mobiles.length === 0 ||
      invalidCount > 0 ||
      !Number.isSafeInteger(templateId) ||
      templateId <= 0
    ) {
      console.error("ADMIN_ORDER_SMS_NOT_CONFIGURED", {
        orderId,
        apiKeyConfigured: Boolean(apiKey),
        configuredCount,
        validMobileCount: mobiles.length,
        invalidMobileCount: invalidCount,
        templateIdValid:
          Number.isSafeInteger(templateId) &&
          templateId > 0,
      });

      return {
        success: false,
        status: "NOT_CONFIGURED",
      };
    }

    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        total: true,
        paymentStatus: true,
        items: {
          select: {
            quantity: true,
          },
        },
      },
    });

    if (!order || order.paymentStatus !== "PAID") {
      return {
        success: false,
        status: "ORDER_NOT_PAID",
      };
    }

    if (
      !Number.isSafeInteger(order.total) ||
      order.total <= 0 ||
      !Array.isArray(order.items) ||
      order.items.length === 0
    ) {
      throw new SmsError("SMS_INVALID_ORDER_DATA");
    }

    // مجموع تعداد واحدهای سفارش
    const itemCount = order.items.reduce(
      (total, item) => {
        if (
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          throw new SmsError("SMS_INVALID_ITEM_QUANTITY");
        }

        return total + item.quantity;
      },
      0,
    );

    if (
      !Number.isSafeInteger(itemCount) ||
      itemCount <= 0
    ) {
      throw new SmsError("SMS_INVALID_ITEM_COUNT");
    }

    const parameters = [
      makeSmsParameter("ORDER", order.id),
      makeSmsParameter("AMOUNT", order.total),
      makeSmsParameter("COUNT", itemCount),
    ];

    /*
     * ایجاد رکورد برای هر شماره.
     * Unique(orderId, mobile) و skipDuplicates جلوی
     * ایجاد رکورد تکراری را می‌گیرند.
     */
    await prisma.adminOrderSmsRecipient.createMany({
      data: mobiles.map((mobile) => ({
        orderId: order.id,
        mobile,
      })),
      skipDuplicates: true,
    });

    const recipients = await prisma.adminOrderSmsRecipient.findMany({
      where: {
        orderId: order.id,
        mobile: {
          in: mobiles,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const summary = {
      total: recipients.length,
      sent: 0,
      failed: 0,
      unknown: 0,
      skipped: 0,
    };

    // ارسال ترتیبی؛ خطای یک گیرنده ارسال بعدی را متوقف نمی‌کند.
    for (const recipient of recipients) {
      try {
        const result = await sendToOneAdmin(
          recipient,
          templateId,
          parameters,
        );

        if (result.status === "SENT") {
          summary.sent++;
        } else if (result.status === "FAILED") {
          summary.failed++;
        } else if (result.status === "UNKNOWN") {
          summary.unknown++;
        } else {
          summary.skipped++;
        }
      } catch (error) {
        summary.unknown++;

        console.error("ADMIN_ORDER_SMS_RECIPIENT_ERROR", {
          orderId: order.id,
          recipientId: recipient.id,
          code: error?.code || "SMS_INTERNAL_ERROR",
        });
      }
    }

    console.info("ADMIN_ORDER_SMS_SUMMARY", {
      orderId: order.id,
      ...summary,
    });

    return {
      success:
        summary.sent === summary.total &&
        summary.total > 0,
      status:
        summary.unknown > 0
          ? "PARTIAL_OR_UNKNOWN"
          : summary.failed > 0
            ? "PARTIAL_FAILURE"
            : summary.sent === summary.total
              ? "SENT"
              : "ALREADY_PROCESSED",
      summary,
    };
  } catch (error) {
    console.error("ADMIN_ORDER_SMS_ERROR", {
      orderId,
      code: error?.code || "SMS_INTERNAL_ERROR",
      name: error?.name,
    });

    return {
      success: false,
      status: "ERROR",
    };
  }
}