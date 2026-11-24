
const MAX_DB_INT = 2_147_483_647;

export class CouponError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "CouponError";
    this.code = code;
    this.status = status;
  }
}

export function normalizeCouponCode(value) {
  if (typeof value !== "string") return "";

  return value.trim().toUpperCase();
}

function validateMoney(value, field, allowZero = true) {
  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > MAX_DB_INT
  ) {
    throw new CouponError(
      "INVALID_COUPON_AMOUNT",
      `مقدار مالی ${field} معتبر نیست.`,
      500
    );
  }
}

export function calculateCouponBenefits({
  coupon,
  productSubtotalToman,
  shippingCostToman,
  now = new Date(),
}) {
  validateMoney(
    productSubtotalToman,
    "productSubtotalToman",
    false
  );

  validateMoney(
    shippingCostToman,
    "shippingCostToman"
  );

  if (!coupon) {
    return {
      couponId: null,
      couponCode: null,
      couponType: null,
      couponDescription: null,
      couponDiscount: 0,
      couponShippingDiscount: 0,
      totalCouponDiscount: 0,
    };
  }

  if (!coupon.isActive) {
    throw new CouponError(
      "COUPON_INACTIVE",
      "این کد تخفیف غیرفعال است."
    );
  }

  if (
    coupon.startsAt &&
    now < new Date(coupon.startsAt)
  ) {
    throw new CouponError(
      "COUPON_NOT_STARTED",
      "زمان استفاده از این کد تخفیف هنوز شروع نشده است."
    );
  }

  if (
    coupon.expiresAt &&
    now >= new Date(coupon.expiresAt)
  ) {
    throw new CouponError(
      "COUPON_EXPIRED",
      "مهلت استفاده از این کد تخفیف به پایان رسیده است."
    );
  }

  const minOrderAmount = Number(
    coupon.minOrderAmount ?? 0
  );

  validateMoney(
    minOrderAmount,
    "minOrderAmount"
  );

  if (productSubtotalToman < minOrderAmount) {
    throw new CouponError(
      "COUPON_MINIMUM_NOT_MET",
      `حداقل مبلغ کالاها برای استفاده از این کد ${minOrderAmount.toLocaleString("fa-IR")} تومان است.`
    );
  }

  let couponDiscount = 0;
  let couponShippingDiscount = 0;

  switch (coupon.type) {
    case "PERCENTAGE": {
      const percent = Number(coupon.value);

      if (
        !Number.isSafeInteger(percent) ||
        percent < 1 ||
        percent > 100
      ) {
        throw new CouponError(
          "INVALID_PERCENTAGE_COUPON",
          "تنظیمات درصد تخفیف معتبر نیست.",
          500
        );
      }

      // محاسبه دقیق با BigInt، بدون خطای اعشاری.
      const rawDiscount = Number(
        (
          BigInt(productSubtotalToman) *
          BigInt(percent)
        ) / 100n
      );

      let discount = rawDiscount;

      if (coupon.maxDiscountAmount != null) {
        const maximum = Number(
          coupon.maxDiscountAmount
        );

        validateMoney(
          maximum,
          "maxDiscountAmount",
          false
        );

        discount = Math.min(discount, maximum);
      }

      couponDiscount = Math.min(
        discount,
        productSubtotalToman
      );

      break;
    }

    case "FIXED": {
      const fixedAmount = Number(coupon.value);

      validateMoney(
        fixedAmount,
        "value",
        false
      );

      couponDiscount = Math.min(
        fixedAmount,
        productSubtotalToman
      );

      break;
    }

    case "FREE_SHIPPING": {
      // ارسال رایگان تمام مرسوله‌های سفارش
      // بدون تغییر مبلغ کالاها یا تسویه تأمین‌کنندگان.
      if (shippingCostToman <= 0) {
        throw new CouponError(
          "NO_SHIPPING_TO_DISCOUNT",
          "این سفارش هزینه ارسال مشمول تخفیف ندارد."
        );
      }

      couponShippingDiscount = shippingCostToman;

      break;
    }

    default:
      throw new CouponError(
        "INVALID_COUPON_TYPE",
        "نوع کد تخفیف معتبر نیست.",
        500
      );
  }

  const totalCouponDiscount =
    couponDiscount + couponShippingDiscount;

  if (
    !Number.isSafeInteger(totalCouponDiscount) ||
    totalCouponDiscount <= 0
  ) {
    throw new CouponError(
      "ZERO_COUPON_DISCOUNT",
      "مبلغ تخفیف این کد معتبر نیست."
    );
  }

  return {
    couponId: coupon.id,
    couponCode: coupon.code,
    couponType: coupon.type,
    couponDescription: coupon.description ?? null,

    couponDiscount,
    couponShippingDiscount,
    totalCouponDiscount,
  };
}

export async function resolveCouponBenefits(
  db,
  {
    couponCode,
    productSubtotalToman,
    shippingCostToman,
    now = new Date(),
  }
) {
  const code = normalizeCouponCode(couponCode);

  if (!code) {
    return calculateCouponBenefits({
      coupon: null,
      productSubtotalToman,
      shippingCostToman,
      now,
    });
  }

  const coupon = await db.coupon.findUnique({
    where: { code },
  });

  if (!coupon) {
    throw new CouponError(
      "COUPON_NOT_FOUND",
      "کد تخفیف واردشده معتبر نیست."
    );
  }

  return calculateCouponBenefits({
    coupon,
    productSubtotalToman,
    shippingCostToman,
    now,
  });
}
