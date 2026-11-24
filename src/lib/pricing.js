
const MAX_DB_INT = 2_147_483_647;
const ROUNDING_UNIT = 10_000;

// نرخ کمیسیون بر اساس قیمت اولیه تأمین‌کننده، به تومان
export const COMMISSION_TIERS = [
  { maxPrice: 1_000_000, percent: 15 },
  { maxPrice: 3_000_000, percent: 14 },
  { maxPrice: 10_000_000, percent: 13 },
  { maxPrice: 30_000_000, percent: 12 },
  { maxPrice: 100_000_000, percent: 11 },
  { maxPrice: Infinity, percent: 10 },
];

export class PricingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}

export function getCommissionPercent(basePrice) {
  if (
    !Number.isSafeInteger(basePrice) ||
    basePrice <= 0 ||
    basePrice > MAX_DB_INT
  ) {
    throw new PricingError(
      "INVALID_BASE_PRICE",
      "قیمت پایه باید یک عدد صحیح و مثبت باشد."
    );
  }

  const tier = COMMISSION_TIERS.find(
    (item) => basePrice < item.maxPrice
  );

  return tier.percent;
}

/**
 * قیمت مشتری را با احتساب کمیسیون برجک محاسبه می‌کند.
 * این مبلغ به نزدیک‌ترین تومان گرد می‌شود.
 */
function calculateCustomerPrice(
  supplierPrice,
  commissionPercent
) {
  const price =
    (
      BigInt(supplierPrice) *
        (100n + BigInt(commissionPercent)) +
      50n
    ) / 100n;

  return price;
}

/**
 * محاسبه قیمت محصول:
 *
 * 1. تعیین کمیسیون بر اساس قیمت اولیه تأمین‌کننده
 * 2. محاسبه قیمت عادی مشتری با احتساب کمیسیون
 * 3. گرد کردن قیمت عادی به بالا تا مضرب ۱۰,۰۰۰
 * 4. کسر تخفیف از قیمت خود تأمین‌کننده
 * 5. محاسبه قیمت تخفیف‌خورده مشتری با احتساب کمیسیون
 * 6. محاسبه مبلغ واقعی قابل پرداخت به تأمین‌کننده
 *
 * تمام مبالغ بر اساس تومان هستند.
 */
export function calculateProductPricing({
  basePrice,
  discount = 0,
}) {
  if (
    !Number.isSafeInteger(basePrice) ||
    basePrice <= 0 ||
    basePrice > MAX_DB_INT
  ) {
    throw new PricingError(
      "INVALID_BASE_PRICE",
      "قیمت پایه معتبر نیست."
    );
  }

  if (
    !Number.isSafeInteger(discount) ||
    discount < 0 ||
    discount > 99
  ) {
    throw new PricingError(
      "INVALID_DISCOUNT",
      "درصد تخفیف باید بین صفر تا ۹۹ باشد."
    );
  }

  // درصد کمیسیون بر اساس قیمت اولیه تعیین می‌شود.
  const commissionPercent =
    getCommissionPercent(basePrice);

  const base = BigInt(basePrice);
  const percent = BigInt(discount);
  const commission = BigInt(commissionPercent);
  const unit = BigInt(ROUNDING_UNIT);

  // مبلغ تخفیف تأمین‌کننده، با گرد کردن به نزدیک‌ترین تومان
  const supplierDiscountAmountBig =
    (base * percent + 50n) / 100n;

  // مبلغ واقعی قابل پرداخت به تأمین‌کننده
  const supplierPayoutPriceBig =
    base - supplierDiscountAmountBig;

  if (supplierPayoutPriceBig <= 0n) {
    throw new PricingError(
      "INVALID_SUPPLIER_PAYOUT",
      "مبلغ قابل پرداخت به تأمین‌کننده پس از تخفیف معتبر نیست."
    );
  }

  // قیمت مشتری قبل از تخفیف تأمین‌کننده
  const originalRawPrice =
    (
      base * (100n + commission) +
      99n
    ) / 100n;

  // گرد کردن قیمت عادی مشتری به بالا تا مضرب ۱۰,۰۰۰
  const originalPriceBig =
    (
      (originalRawPrice + unit - 1n) /
      unit
    ) * unit;

  // قیمت مشتری بعد از تخفیف تأمین‌کننده
  let priceBig;

  if (
    discount === 0 ||
    supplierDiscountAmountBig === 0n
  ) {
    priceBig = originalPriceBig;
  } else {
    priceBig = calculateCustomerPrice(
      supplierPayoutPriceBig,
      commissionPercent
    );
  }

  if (
    originalPriceBig > BigInt(MAX_DB_INT) ||
    priceBig > BigInt(MAX_DB_INT)
  ) {
    throw new PricingError(
      "PRICE_OVERFLOW",
      "قیمت محاسبه‌شده بیش از محدوده مجاز دیتابیس است."
    );
  }

  const price = Number(priceBig);
  const originalPrice = Number(originalPriceBig);
  const supplierDiscountAmount = Number(
    supplierDiscountAmountBig
  );
  const supplierPayoutPrice = Number(
    supplierPayoutPriceBig
  );

  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(originalPrice) ||
    originalPrice <= 0 ||
    !Number.isSafeInteger(supplierPayoutPrice) ||
    supplierPayoutPrice <= 0
  ) {
    throw new PricingError(
      "INVALID_FINAL_PRICE",
      "مقادیر مالی محاسبه‌شده معتبر نیستند."
    );
  }

  return {
    basePrice,
    supplierDiscountAmount,
    supplierPayoutPrice,
    commissionPercent,
    originalPrice,
    price,
    discount,
  };
}
