
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/checkout";
import { validateProvinceCity } from "@/lib/iranLocations";
import {
  calculateProductPricing,
  PricingError,
} from "@/lib/pricing";
import {
  calculateZarinpalPaymentAmount,
  ZarinpalFeeError,
} from "@/lib/zarinpal-fee";
import {
  CouponError,
  resolveCouponBenefits,
} from "@/lib/coupons";

const SHIPPING_COST_PER_FULFILLMENT = 200_000;
const MAX_QUANTITY_PER_ITEM = 20;
const MAX_DB_INT = 2_147_483_647;
const BORJAK_SELLER_KEY = "BORJAK";

function validateProduct(product) {
  if (
    !product ||
    product.deletedAt ||
    !product.isPublished
  ) {
    throw new PricingError(
      "PRODUCT_UNAVAILABLE",
      "یکی از کالاهای سبد خرید دیگر قابل خرید نیست."
    );
  }

  const price = Number(product.price);
  const originalPrice = Number(product.originalPrice);

  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(originalPrice) ||
    originalPrice <= 0
  ) {
    throw new PricingError(
      "INVALID_PRODUCT_PRICE",
      "قیمت یکی از کالاها معتبر نیست."
    );
  }

  if (product.basePrice == null) {
    return {
      price,
      supplierId: product.supplierId ?? null,
    };
  }

  const basePrice = Number(product.basePrice);

  if (
    !Number.isSafeInteger(basePrice) ||
    basePrice <= 0
  ) {
    throw new PricingError(
      "INVALID_BASE_PRICE",
      "قیمت پایه یکی از کالاها معتبر نیست."
    );
  }

  const pricing = calculateProductPricing({
    basePrice,
    discount: Number(product.discount ?? 0),
  });

  if (
    pricing.price !== price ||
    pricing.originalPrice !== originalPrice ||
    pricing.commissionPercent !==
      Number(product.commissionPercent)
  ) {
    throw new PricingError(
      "PRODUCT_PRICING_MISMATCH",
      "قیمت یکی از کالاها با موتور قیمت‌گذاری هماهنگ نیست."
    );
  }

  return {
    price,
    supplierId: product.supplierId ?? null,
  };
}

function buildSellerGroups(cartItems) {
  const groups = new Map();

  for (const item of cartItems) {
    const product = item.product;

    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_QUANTITY_PER_ITEM
    ) {
      throw new PricingError(
        "INVALID_CART_ITEM",
        "تعداد یکی از کالاهای سبد خرید معتبر نیست."
      );
    }

    const supplierId =
      typeof product.supplierId === "string" &&
      product.supplierId.trim()
        ? product.supplierId
        : null;

    const sellerIdentity = supplierId
      ? `SUPPLIER:${supplierId}`
      : BORJAK_SELLER_KEY;

    let group = groups.get(sellerIdentity);

    if (!group) {
      group = {
        sellerIdentity,
        representativeProductId: productId,
        items: [],
      };

      groups.set(sellerIdentity, group);
    }

    group.representativeProductId = Math.min(
      group.representativeProductId,
      productId
    );

    group.items.push({
      productId,
      quantity,
    });
  }

  return [...groups.values()].map((group) => ({
    clientKey: `seller-${group.representativeProductId}`,
    items: group.items,
  }));
}

function validateShippingSelections(groups, selections) {
  const expectedKeys = groups
    .map((group) => group.clientKey)
    .sort();

  const suppliedKeys = Object.keys(selections || {}).sort();

  if (
    expectedKeys.length !== suppliedKeys.length ||
    expectedKeys.some(
      (key, index) => key !== suppliedKeys[index]
    )
  ) {
    throw new PricingError(
      "INVALID_SHIPPING_SELECTION",
      "روش ارسال همه مرسوله‌ها را انتخاب کنید."
    );
  }

  return groups.map((group) => {
    const method = selections[group.clientKey];

    if (!["POST", "POST_EXPRESS"].includes(method)) {
      throw new PricingError(
        "INVALID_SHIPPING_METHOD",
        "روش ارسال یکی از مرسوله‌ها معتبر نیست."
      );
    }

    return {
      clientKey: group.clientKey,
      shippingMethod: method,
      shippingCost: SHIPPING_COST_PER_FULFILLMENT,
    };
  });
}

function calculateCartAmounts(cartItems) {
  let productSubtotalToman = 0;

  for (const item of cartItems) {
    const quantity = Number(item.quantity);
    const financial = validateProduct(item.product);

    const stock = Number(item.product.stock);
    const reservedStock = Number(item.product.reservedStock);

    if (
      !Number.isSafeInteger(stock) ||
      !Number.isSafeInteger(reservedStock) ||
      quantity > Math.max(0, stock - reservedStock)
    ) {
      throw new PricingError(
        "INSUFFICIENT_STOCK",
        `موجودی کالای «${item.product.title}» کافی نیست.`
      );
    }

    const lineTotal = financial.price * quantity;

    if (
      !Number.isSafeInteger(lineTotal) ||
      !Number.isSafeInteger(
        productSubtotalToman + lineTotal
      )
    ) {
      throw new PricingError(
        "INVALID_ORDER_TOTAL",
        "مبلغ کالاهای سفارش معتبر نیست."
      );
    }

    productSubtotalToman += lineTotal;
  }

  return productSubtotalToman;
}

function validateFinalAmounts({
  productSubtotalToman,
  shippingCostToman,
  couponDiscountToman,
  couponShippingDiscountToman,
  requiredAmountToman,
  gatewayFeeToman,
  totalAmountToman,
}) {
  const amounts = [
    productSubtotalToman,
    shippingCostToman,
    couponDiscountToman,
    couponShippingDiscountToman,
    requiredAmountToman,
    gatewayFeeToman,
    totalAmountToman,
  ];

  if (
    !amounts.every(
      (amount) =>
        Number.isSafeInteger(amount) &&
        amount >= 0 &&
        amount <= MAX_DB_INT
    )
  ) {
    throw new PricingError(
      "INVALID_ORDER_TOTAL",
      "مبالغ محاسبه‌شده سفارش معتبر نیستند."
    );
  }

  const expectedRequired =
    productSubtotalToman -
    couponDiscountToman +
    shippingCostToman -
    couponShippingDiscountToman;

  if (
    expectedRequired <= 0 ||
    expectedRequired !== requiredAmountToman ||
    totalAmountToman !==
      requiredAmountToman + gatewayFeeToman
  ) {
    throw new PricingError(
      "PAYMENT_TOTAL_MISMATCH",
      "محاسبات تخفیف و مبلغ نهایی سفارش هماهنگ نیست."
    );
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "اطلاعات پیش‌فاکتور معتبر نیست.",
        },
        { status: 400 }
      );
    }

    const {
      provinceId,
      cityId,
      shippingMethodsBySeller,
      couponCode,
    } = parsed.data;

    const location = validateProvinceCity(
      provinceId,
      cityId
    );

    if (!location.valid) {
      return NextResponse.json(
        { error: location.message },
        { status: 400 }
      );
    }

    // قیمت و مالکیت محصولات فقط از دیتابیس خوانده می‌شوند.
    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
      },

      include: {
        product: {
          select: {
            id: true,
            title: true,
            stock: true,
            reservedStock: true,
            isPublished: true,
            deletedAt: true,
            price: true,
            originalPrice: true,
            basePrice: true,
            commissionPercent: true,
            discount: true,
            supplierId: true,
          },
        },
      },

      orderBy: {
        productId: "asc",
      },
    });

    if (!cartItems.length) {
      return NextResponse.json(
        { error: "سبد خرید خالی است." },
        { status: 400 }
      );
    }

    if (cartItems.some((item) => !item.product)) {
      return NextResponse.json(
        {
          error:
            "یکی از کالاهای سبد خرید دیگر در دسترس نیست. سبد خرید را تازه‌سازی کنید.",
        },
        { status: 409 }
      );
    }

    // گروه‌بندی با مالک واقعی محصولات
    const groups = buildSellerGroups(cartItems);

    // اعتبارسنجی انتخاب روش ارسال همه مرسوله‌ها
    const shipments = validateShippingSelections(
      groups,
      shippingMethodsBySeller
    );

    const productSubtotalToman =
      calculateCartAmounts(cartItems);

    const shippingCostToman = shipments.reduce(
      (sum, shipment) => sum + shipment.shippingCost,
      0
    );

    if (
      !Number.isSafeInteger(shippingCostToman) ||
      shippingCostToman < 0
    ) {
      throw new PricingError(
        "INVALID_SHIPPING_TOTAL",
        "هزینه ارسال سفارش معتبر نیست."
      );
    }

    // اعتبارسنجی و محاسبه تخفیف از روی کوپن واقعی دیتابیس
    const couponBenefits = await resolveCouponBenefits(
      prisma,
      {
        couponCode,
        productSubtotalToman,
        shippingCostToman,
      }
    );

    const {
      couponId,
      couponCode: appliedCouponCode,
      couponType,
      couponDescription,
      couponDiscount,
      couponShippingDiscount,
      totalCouponDiscount,
    } = couponBenefits;

    // محاسبه مبلغ قابل پرداخت پس از اعمال تخفیف
    const requiredAmountToman =
      productSubtotalToman -
      couponDiscount +
      shippingCostToman -
      couponShippingDiscount;

    if (
      !Number.isSafeInteger(requiredAmountToman) ||
      requiredAmountToman <= 0
    ) {
      throw new PricingError(
        "INVALID_ORDER_TOTAL",
        "مبلغ نهایی سفارش معتبر نیست."
      );
    }

    // محاسبه کارمزد زرین‌پال روی مبلغ پس از تخفیف
    const paymentQuote =
      await calculateZarinpalPaymentAmount(
        requiredAmountToman
      );

    const gatewayFeeToman =
      paymentQuote.gatewayFeeToman;

    const totalAmountToman =
      paymentQuote.totalAmountToman;

    validateFinalAmounts({
      productSubtotalToman,
      shippingCostToman,
      couponDiscountToman: couponDiscount,
      couponShippingDiscountToman: couponShippingDiscount,
      requiredAmountToman,
      gatewayFeeToman,
      totalAmountToman,
    });

    // ثبت سهم تخفیف ارسال برای هر مرسوله
    const quotedShipments = shipments.map((shipment) => {
      const shippingDiscount =
        couponShippingDiscount > 0
          ? shipment.shippingCost
          : 0;

      return {
        sellerKey: shipment.clientKey,
        shippingMethod: shipment.shippingMethod,

        shippingCost: shipment.shippingCost,
        shippingDiscount,

        finalShippingCost:
          shipment.shippingCost - shippingDiscount,
      };
    });

    return NextResponse.json(
      {
        success: true,

        quote: {
          productSubtotalToman,
          shippingCostToman,

          // تخفیف روی مبلغ کالاها
          couponDiscountToman: couponDiscount,

          // تخفیف هزینه ارسال
          couponShippingDiscountToman:
            couponShippingDiscount,

          // مجموع تخفیف کالا و ارسال
          totalCouponDiscountToman:
            totalCouponDiscount,

          // مبلغ کالاها + ارسال پس از تخفیف
          requiredAmountToman,

          gatewayFeeToman,
          totalAmountToman,

          feeType: paymentQuote.feeType,

          coupon: couponId
            ? {
                id: couponId,
                code: appliedCouponCode,
                type: couponType,
                description: couponDescription,
                productDiscountToman: couponDiscount,
                shippingDiscountToman:
                  couponShippingDiscount,
                totalDiscountToman:
                  totalCouponDiscount,
              }
            : null,

          couponApplied: Boolean(couponId),

          shipmentCount: quotedShipments.length,
          shipments: quotedShipments,

          quotedAt: new Date().toISOString(),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  } catch (error) {
    console.error("PAYMENT_QUOTE_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    if (error instanceof CouponError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (error instanceof PricingError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 409,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    if (error instanceof ZarinpalFeeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "خطا در محاسبه پیش‌فاکتور سفارش" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
