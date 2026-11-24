import {
  ZARINPAL_CURRENCY,
  ZARINPAL_FEE_CALCULATION_URL,
  toZarinpalAmount,
} from "@/lib/zarinpal";

const MAX_FEE_CALCULATION_ATTEMPTS = 8;

export class ZarinpalFeeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ZarinpalFeeError";
    this.code = code;
  }
}

function validateAmount(amountToman) {
  if (
    !Number.isSafeInteger(amountToman) ||
    amountToman <= 0
  ) {
    throw new ZarinpalFeeError(
      "INVALID_AMOUNT",
      "مبلغ سفارش برای محاسبه کارمزد معتبر نیست."
    );
  }
}

function getMerchantId() {
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;

  if (
    typeof merchantId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      merchantId
    )
  ) {
    throw new ZarinpalFeeError(
      "INVALID_MERCHANT_ID",
      "شناسه پذیرنده زرین‌پال معتبر نیست."
    );
  }

  return merchantId;
}

async function requestFeeCalculation(amountRial, merchantId) {
  let response;

  try {
    response = await fetch(
      ZARINPAL_FEE_CALCULATION_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          merchant_id: merchantId,
          amount: amountRial,
          currency: ZARINPAL_CURRENCY,
        }),
      }
    );
  } catch {
    throw new ZarinpalFeeError(
      "FEE_API_NETWORK_ERROR",
      "ارتباط با سرویس محاسبه کارمزد زرین‌پال برقرار نشد."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new ZarinpalFeeError(
      "INVALID_FEE_RESPONSE",
      "پاسخ سرویس محاسبه کارمزد زرین‌پال معتبر نیست."
    );
  }

  if (!response.ok) {
    throw new ZarinpalFeeError(
      "FEE_API_HTTP_ERROR",
      "سرویس محاسبه کارمزد زرین‌پال در دسترس نیست."
    );
  }

  const data = result?.data;

  if (
    !data ||
    Number(data.code) !== 100 ||
    !Number.isSafeInteger(Number(data.amount)) ||
    Number(data.amount) !== amountRial ||
    !Number.isSafeInteger(Number(data.fee)) ||
    Number(data.fee) < 0 ||
    typeof data.fee_type !== "string"
  ) {
    throw new ZarinpalFeeError(
      "INVALID_FEE_DATA",
      "اطلاعات کارمزد دریافتی از زرین‌پال ناقص یا نامعتبر است."
    );
  }

  const feeType = data.fee_type.trim().toUpperCase();

  if (!["MERCHANT", "PAYER"].includes(feeType)) {
    throw new ZarinpalFeeError(
      "UNKNOWN_FEE_TYPE",
      "نوع پرداخت کارمزد زرین‌پال قابل تشخیص نیست."
    );
  }

  return {
    amountRial: Number(data.amount),
    feeRial: Number(data.fee),
    feeType,
  };
}

/**
 * محاسبه مبلغ پرداخت با توجه به نوع کارمزد زرین‌پال.
 *
 * تمام ورودی‌ها و خروجی‌های مالی این تابع به تومان هستند،
 * به جز feeRial و amountRial که واحدشان ریال است.
 *
 * MERCHANT:
 * مبلغ پرداخت به‌صورت پلکانی افزایش می‌یابد تا پس از
 * کسر کارمزد، مبلغ خالص کمتر از مبلغ موردنیاز سفارش نباشد.
 *
 * PAYER:
 * کارمزد را خود درگاه از پرداخت‌کننده دریافت می‌کند؛
 * بنابراین هزینه دیگری به مبلغ سفارش اضافه نمی‌کنیم.
 *
 * در پاسخ ناقص یا خطای API هیچ نرخ تخمینی استفاده نمی‌شود.
 */
export async function calculateZarinpalPaymentAmount(
  requiredAmountToman
) {
  validateAmount(requiredAmountToman);

  if (
    !ZARINPAL_FEE_CALCULATION_URL ||
    ZARINPAL_CURRENCY !== "IRR"
  ) {
    throw new ZarinpalFeeError(
      "INVALID_GATEWAY_CONFIGURATION",
      "تنظیمات محاسبه کارمزد زرین‌پال معتبر نیست."
    );
  }

  const merchantId = getMerchantId();

  const requiredAmountRial = toZarinpalAmount(
    requiredAmountToman
  );

  let candidateAmountToman = requiredAmountToman;
  let expectedFeeType = null;

  for (
    let attempt = 0;
    attempt < MAX_FEE_CALCULATION_ATTEMPTS;
    attempt += 1
  ) {
    const candidateAmountRial = toZarinpalAmount(
      candidateAmountToman
    );

    const quote = await requestFeeCalculation(
      candidateAmountRial,
      merchantId
    );

    if (
      expectedFeeType !== null &&
      quote.feeType !== expectedFeeType
    ) {
      throw new ZarinpalFeeError(
        "FEE_TYPE_CHANGED",
        "نوع محاسبه کارمزد زرین‌پال در طول استعلام تغییر کرده است."
      );
    }

    expectedFeeType = quote.feeType;

    // در حالت PAYER، کارمزد جداگانه توسط درگاه دریافت می‌شود.
    if (quote.feeType === "PAYER") {
      return {
        requiredAmountToman,
        totalAmountToman: requiredAmountToman,
        gatewayFeeToman: 0,
        feeRial: quote.feeRial,
        amountRial: candidateAmountRial,
        feeType: quote.feeType,
      };
    }

    // در حالت MERCHANT باید پس از کسر کارمزد،
    // حداقل مبلغ موردنیاز سفارش باقی بماند.
    const netAmountRial =
      candidateAmountRial - quote.feeRial;

    if (netAmountRial >= requiredAmountRial) {
      return {
        requiredAmountToman,
        totalAmountToman: candidateAmountToman,
        gatewayFeeToman:
          candidateAmountToman - requiredAmountToman,
        feeRial: quote.feeRial,
        amountRial: candidateAmountRial,
        feeType: quote.feeType,
      };
    }

    // مقدار بعدی رو به بالا و بر اساس تومان محاسبه می‌شود.
    const nextAmountToman = Math.ceil(
      (requiredAmountRial + quote.feeRial) / 10
    );

    if (
      !Number.isSafeInteger(nextAmountToman) ||
      nextAmountToman <= candidateAmountToman
    ) {
      throw new ZarinpalFeeError(
        "INVALID_GROSS_UP_AMOUNT",
        "محاسبه مبلغ پوشش‌دهنده کارمزد زرین‌پال ناموفق بود."
      );
    }

    candidateAmountToman = nextAmountToman;
  }

  throw new ZarinpalFeeError(
    "FEE_CALCULATION_LIMIT",
    "محاسبه مبلغ نهایی کارمزد زرین‌پال به نتیجه قطعی نرسید."
  );
}