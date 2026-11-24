
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, logAction } from "@/lib/auth";
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

const SHIPPING_METHODS = new Set([
  "POST",
  "POST_EXPRESS",
]);

const FINANCIAL_SNAPSHOT_FIELDS = [
  "basePriceAtPurchase",
  "commissionPercentAtPurchase",
  "originalPriceAtPurchase",
  "supplierDiscountPercentAtPurchase",
  "supplierDiscountAmountAtPurchase",
  "supplierPayoutAtPurchase",
  "commissionAmountAtPurchase",
];

const INTERNAL_ITEM_FIELDS = [
  "supplierId",
  "supplierSnapshotCaptured",
  ...FINANCIAL_SNAPSHOT_FIELDS,
];

const INTERNAL_PRODUCT_FIELDS = [
  "basePrice",
  "commissionPercent",
  "supplierId",
  "reservedStock",
  "republishAfterReview",
  "reviewNote",
];

const ORDER_PRODUCT_SELECT = {
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
};

function getAvailableStock(product) {
  const stock = Number(product?.stock ?? 0);
  const reservedStock = Number(product?.reservedStock ?? 0);

  if (
    !Number.isSafeInteger(stock) ||
    !Number.isSafeInteger(reservedStock)
  ) {
    return 0;
  }

  return Math.max(0, stock - reservedStock);
}

/**
 * ساخت Snapshot مالی محصول.
 * تخفیف فروشگاه و کارمزد درگاه روی تسویه فروشنده اثر ندارند.
 */
function getProductFinancialSnapshot(product) {
  const price = Number(product?.price);
  const originalPrice = Number(product?.originalPrice);

  if (
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    !Number.isSafeInteger(originalPrice) ||
    originalPrice <= 0
  ) {
    throw new PricingError(
      "INVALID_PRODUCT_PRICE",
      "قیمت محصول برای ثبت سفارش معتبر نیست."
    );
  }

  const supplierId =
    typeof product.supplierId === "string" &&
    product.supplierId.trim()
      ? product.supplierId
      : null;

  const basePrice =
    product.basePrice == null
      ? null
      : Number(product.basePrice);

  let pricing = null;

  // محصولات قدیمی بدون basePrice قیمت تاریخی خود را حفظ می‌کنند.
  if (basePrice !== null) {
    if (
      !Number.isSafeInteger(basePrice) ||
      basePrice <= 0
    ) {
      throw new PricingError(
        "INVALID_BASE_PRICE",
        "قیمت پایه محصول معتبر نیست."
      );
    }

    pricing = calculateProductPricing({
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
        "قیمت محصول با موتور قیمت‌گذاری هماهنگ نیست. لطفاً اطلاعات محصول بررسی شود."
      );
    }
  }

  const commissionPercent =
    pricing?.commissionPercent ??
    (
      Number.isSafeInteger(Number(product.commissionPercent))
        ? Number(product.commissionPercent)
        : null
    );

  const hasSellerPricing =
    supplierId !== null && pricing !== null;

  const supplierDiscountPercent = hasSellerPricing
    ? pricing.discount
    : null;

  const supplierDiscountAmount = hasSellerPricing
    ? pricing.supplierDiscountAmount
    : null;

  const supplierPayout = hasSellerPricing
    ? pricing.supplierPayoutPrice
    : null;

  const commissionAmount = hasSellerPricing
    ? price - supplierPayout
    : null;

  if (
    hasSellerPricing &&
    (
      !Number.isSafeInteger(commissionAmount) ||
      commissionAmount < 0
    )
  ) {
    throw new PricingError(
      "INVALID_COMMISSION_AMOUNT",
      "مبلغ کمیسیون محاسبه‌شده معتبر نیست."
    );
  }

  return {
    supplierId,
    price,

    basePriceAtPurchase: basePrice,
    commissionPercentAtPurchase: commissionPercent,
    originalPriceAtPurchase: originalPrice,

    supplierDiscountPercentAtPurchase:
      supplierDiscountPercent,

    supplierDiscountAmountAtPurchase:
      supplierDiscountAmount,

    supplierPayoutAtPurchase:
      supplierPayout,

    commissionAmountAtPurchase:
      commissionAmount,
  };
}

function getCartSnapshot(items) {
  return items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      ...getProductFinancialSnapshot(item.product),
    }))
    .sort((a, b) => a.productId - b.productId);
}

function getOrderItemSnapshot(item) {
  return {
    productId: item.productId,
    quantity: item.quantity,
    supplierId: item.supplierId ?? null,
    price: Number(item.price),

    basePriceAtPurchase:
      item.basePriceAtPurchase ?? null,

    commissionPercentAtPurchase:
      item.commissionPercentAtPurchase ?? null,

    originalPriceAtPurchase:
      item.originalPriceAtPurchase ?? null,

    supplierDiscountPercentAtPurchase:
      item.supplierDiscountPercentAtPurchase ?? null,

    supplierDiscountAmountAtPurchase:
      item.supplierDiscountAmountAtPurchase ?? null,

    supplierPayoutAtPurchase:
      item.supplierPayoutAtPurchase ?? null,

    commissionAmountAtPurchase:
      item.commissionAmountAtPurchase ?? null,
  };
}

/**
 * گروه‌بندی محصولات بر اساس مالک واقعی دیتابیس.
 */
function buildFulfillmentGroups(items, getProduct) {
  const groupsBySeller = new Map();

  for (const item of items) {
    const product = getProduct(item);

    if (
      !product ||
      !Object.prototype.hasOwnProperty.call(
        product,
        "supplierId"
      )
    ) {
      throw new Error(
        "Product ownership could not be resolved"
      );
    }

    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(productId) ||
      productId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      throw new Error("Invalid order item");
    }

    const supplierId =
      typeof product.supplierId === "string" &&
      product.supplierId.trim()
        ? product.supplierId
        : null;

    const sellerKey = supplierId
      ? `SUPPLIER:${supplierId}`
      : BORJAK_SELLER_KEY;

    let group = groupsBySeller.get(sellerKey);

    if (!group) {
      group = {
        sellerKey,
        supplierId,
        representativeProductId: productId,
        clientKey: `seller-${productId}`,
        items: [],
      };

      groupsBySeller.set(sellerKey, group);
    }

    group.representativeProductId = Math.min(
      group.representativeProductId,
      productId
    );

    group.items.push({
      productId,
      quantity,
      orderItemId: Number.isSafeInteger(item.id)
        ? item.id
        : null,
    });
  }

  return [...groupsBySeller.values()]
    .map((group) => ({
      ...group,
      clientKey: `seller-${group.representativeProductId}`,
      items: group.items.sort(
        (a, b) => a.productId - b.productId
      ),
    }))
    .sort((a, b) =>
      a.sellerKey.localeCompare(b.sellerKey)
    );
}

/**
 * تطبیق انتخاب روش ارسال مرورگر با گروه‌های واقعی فروشنده.
 */
function applyShippingMethods(
  groups,
  shippingMethodsBySeller
) {
  const methods =
    shippingMethodsBySeller &&
    typeof shippingMethodsBySeller === "object"
      ? shippingMethodsBySeller
      : {};

  const expectedKeys = groups
    .map((group) => group.clientKey)
    .sort();

  const suppliedKeys = Object.keys(methods).sort();

  if (
    expectedKeys.length !== suppliedKeys.length ||
    expectedKeys.some(
      (key, index) => key !== suppliedKeys[index]
    )
  ) {
    return null;
  }

  const plannedGroups = groups.map((group) => {
    const shippingMethod = methods[group.clientKey];

    if (!SHIPPING_METHODS.has(shippingMethod)) {
      return null;
    }

    return {
      ...group,
      shippingMethod,
      shippingCost: SHIPPING_COST_PER_FULFILLMENT,
    };
  });

  if (plannedGroups.some((group) => group === null)) {
    return null;
  }

  return plannedGroups;
}

function getTotalShippingCost(groups) {
  const total = groups.reduce(
    (sum, group) => sum + group.shippingCost,
    0
  );

  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error("Invalid shipping total");
  }

  return total;
}

function getLegacyOrderShippingMethod(groups) {
  return groups.length === 1
    ? groups[0].shippingMethod
    : null;
}

function hasSameCouponBenefits(first, second) {
  return (
    first.couponId === second.couponId &&
    first.couponCode === second.couponCode &&
    first.couponType === second.couponType &&
    first.couponDiscount === second.couponDiscount &&
    first.couponShippingDiscount ===
      second.couponShippingDiscount
  );
}

function getFulfillmentSnapshot(groups) {
  return groups
    .map((group) => ({
      sellerKey: group.sellerKey,
      supplierId: group.supplierId ?? null,
      clientKey: group.clientKey,
      shippingMethod: group.shippingMethod,
      shippingCost: Number(group.shippingCost),
      productIds: group.items
        .map((item) => item.productId)
        .sort((a, b) => a - b),
    }))
    .sort((a, b) =>
      a.sellerKey.localeCompare(b.sellerKey)
    );
}

function hasSameSellerGroups(first, second) {
  const firstSnapshot = getFulfillmentSnapshot(
    first.map((group) => ({
      ...group,
      shippingMethod: group.shippingMethod ?? "POST",
      shippingCost: group.shippingCost ?? 0,
    }))
  );

  const secondSnapshot = getFulfillmentSnapshot(
    second.map((group) => ({
      ...group,
      shippingMethod: group.shippingMethod ?? "POST",
      shippingCost: group.shippingCost ?? 0,
    }))
  );

  return (
    JSON.stringify(
      firstSnapshot.map(
        ({ sellerKey, supplierId, clientKey, productIds }) => ({
          sellerKey,
          supplierId,
          clientKey,
          productIds,
        })
      )
    ) ===
    JSON.stringify(
      secondSnapshot.map(
        ({ sellerKey, supplierId, clientKey, productIds }) => ({
          sellerKey,
          supplierId,
          clientKey,
          productIds,
        })
      )
    )
  );
}

function isSameCheckout(order, data) {
  const oldItems = order.items
    .map(getOrderItemSnapshot)
    .sort((a, b) => a.productId - b.productId);

  const newItems = getCartSnapshot(data.cartItems);

  const sameItems =
    JSON.stringify(oldItems) === JSON.stringify(newItems);

  const sameReceiver =
    order.receiverName === data.receiverName &&
    order.receiverPhone === data.receiverPhone &&
    order.provinceId === data.provinceId &&
    order.cityId === data.cityId &&
    order.address === data.address &&
    order.postalCode === data.postalCode &&
    order.requiresPrintedInvoice ===
      data.requiresPrintedInvoice;

  const existingFulfillmentPlan = (
    order.fulfillments || []
  )
    .map((fulfillment) => ({
      sellerKey: fulfillment.sellerKey,
      supplierId: fulfillment.supplierId ?? null,
      shippingMethod: fulfillment.shippingMethod,
      shippingCost: Number(fulfillment.shippingCost),
      shippingDiscount: Number(
        fulfillment.shippingDiscount ?? 0
      ),
    }))
    .sort((a, b) =>
      a.sellerKey.localeCompare(b.sellerKey)
    );

  const requestedFulfillmentPlan =
    data.fulfillmentGroups
      .map((group) => ({
        sellerKey: group.sellerKey,
        supplierId: group.supplierId ?? null,
        shippingMethod: group.shippingMethod,
        shippingCost: Number(group.shippingCost),
        shippingDiscount:
          data.couponShippingDiscount > 0
            ? Number(group.shippingCost)
            : 0,
      }))
      .sort((a, b) =>
        a.sellerKey.localeCompare(b.sellerKey)
      );

  const sameFulfillments =
    JSON.stringify(existingFulfillmentPlan) ===
    JSON.stringify(requestedFulfillmentPlan);

  const sameCoupon = hasSameCouponBenefits(
    {
      couponId: order.couponId ?? null,
      couponCode: order.couponCode ?? null,
      couponType: order.couponType ?? null,
      couponDiscount: Number(order.couponDiscount ?? 0),
      couponShippingDiscount: Number(
        order.couponShippingDiscount ?? 0
      ),
    },
    {
      couponId: data.couponId,
      couponCode: data.couponCode,
      couponType: data.couponType,
      couponDiscount: data.couponDiscount,
      couponShippingDiscount:
        data.couponShippingDiscount,
    }
  );

  return (
    sameItems &&
    sameReceiver &&
    sameFulfillments &&
    sameCoupon &&
    Number(order.shippingCost) === data.shippingCost &&
    Number(order.gatewayFee) === data.gatewayFee &&
    Number(order.total) === data.total
  );
}

function hasCompleteSupplierSnapshot(items) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => {
      if (item?.supplierSnapshotCaptured !== true) {
        return false;
      }

      if (item.supplierId === null) {
        return true;
      }

      if (
        typeof item.supplierId !== "string" ||
        !item.supplierId.trim()
      ) {
        return false;
      }

      const requiredFinancialFields = [
        item.basePriceAtPurchase,
        item.commissionPercentAtPurchase,
        item.originalPriceAtPurchase,
        item.supplierDiscountPercentAtPurchase,
        item.supplierDiscountAmountAtPurchase,
        item.supplierPayoutAtPurchase,
        item.commissionAmountAtPurchase,
      ];

      return requiredFinancialFields.every(
        (value) =>
          value !== null &&
          Number.isSafeInteger(Number(value))
      );
    })
  );
}

function normalizeOrderProducts(orders) {
  return orders.map((order) => ({
    ...order,

    items: order.items.map((item) => {
      const publicItem = { ...item };

      for (const field of INTERNAL_ITEM_FIELDS) {
        delete publicItem[field];
      }

      if (!item.product) {
        return publicItem;
      }

      const publicProduct = { ...item.product };

      for (const field of INTERNAL_PRODUCT_FIELDS) {
        delete publicProduct[field];
      }

      return {
        ...publicItem,
        product: {
          ...publicProduct,
          availableStock: getAvailableStock(item.product),
        },
      };
    }),
  }));
}

async function lockUser(tx, userId) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;
}

async function lockProducts(tx, productIds) {
  for (const productId of productIds) {
    await tx.$queryRaw`
      SELECT "id"
      FROM "Product"
      WHERE "id" = ${productId}
      FOR UPDATE
    `;
  }
}

function getSortedProductIds(items) {
  return [
    ...new Set(items.map((item) => item.productId)),
  ].sort((a, b) => a - b);
}

function createOrderItemData(product, item, orderId) {
  const financial = getProductFinancialSnapshot(product);

  return {
    orderId,

    productId: item.productId,
    quantity: item.quantity,

    price: financial.price,

    supplierId: financial.supplierId,
    supplierSnapshotCaptured: true,

    basePriceAtPurchase:
      financial.basePriceAtPurchase,

    commissionPercentAtPurchase:
      financial.commissionPercentAtPurchase,

    originalPriceAtPurchase:
      financial.originalPriceAtPurchase,

    supplierDiscountPercentAtPurchase:
      financial.supplierDiscountPercentAtPurchase,

    supplierDiscountAmountAtPurchase:
      financial.supplierDiscountAmountAtPurchase,

    supplierPayoutAtPurchase:
      financial.supplierPayoutAtPurchase,

    commissionAmountAtPurchase:
      financial.commissionAmountAtPurchase,
  };
}

/**
 * ساخت اقلام سفارش و مرسوله‌های مستقل در همان تراکنش.
 * کوپن ارسال رایگان روی تمام مرسوله‌ها ذخیره می‌شود.
 */
async function createOrderItemsAndFulfillments(
  tx,
  {
    orderId,
    cartItems,
    productMap,
    shippingMethodsBySeller,
    couponShippingDiscount = 0,
  }
) {
  const createdOrderItems = [];

  const sortedCartItems = [...cartItems].sort(
    (a, b) => a.productId - b.productId
  );

  for (const item of sortedCartItems) {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new Error(
        `Product ${item.productId} was not found during order creation`
      );
    }

    const orderItem = await tx.orderItem.create({
      data: createOrderItemData(
        product,
        item,
        orderId
      ),

      select: {
        id: true,
        productId: true,
        quantity: true,
        supplierId: true,
      },
    });

    createdOrderItems.push(orderItem);
  }

  const groups = buildFulfillmentGroups(
    createdOrderItems,
    (item) => item
  );

  const plannedGroups = applyShippingMethods(
    groups,
    shippingMethodsBySeller
  );

  if (!plannedGroups) {
    throw new Error(
      "Shipping selections do not match persisted order items"
    );
  }

  const totalShippingCost = getTotalShippingCost(
    plannedGroups
  );

  if (
    !Number.isSafeInteger(couponShippingDiscount) ||
    couponShippingDiscount < 0 ||
    couponShippingDiscount > totalShippingCost ||
    (
      couponShippingDiscount !== 0 &&
      couponShippingDiscount !== totalShippingCost
    )
  ) {
    throw new Error(
      "Coupon shipping discount does not match fulfillment shipping cost"
    );
  }

  for (const group of plannedGroups) {
    await tx.orderFulfillment.create({
      data: {
        orderId,
        supplierId: group.supplierId,
        sellerKey: group.sellerKey,
        shippingMethod: group.shippingMethod,
        shippingCost: group.shippingCost,

        shippingDiscount:
          couponShippingDiscount > 0
            ? group.shippingCost
            : 0,

        items: {
          create: group.items.map((item) => {
            if (!item.orderItemId) {
              throw new Error(
                "Fulfillment item is missing its order item ID"
              );
            }

            return {
              orderItemId: item.orderItemId,
              quantity: item.quantity,
            };
          }),
        },
      },
    });
  }

  return {
    orderItems: createdOrderItems,
    fulfillmentGroups: plannedGroups,
    shippingCost: totalShippingCost,
  };
}

function getOrderFulfillmentSelect() {
  return {
    id: true,
    sellerKey: true,
    supplierId: true,
    shippingMethod: true,
    shippingCost: true,
    shippingDiscount: true,
    status: true,
    trackingCode: true,
    handedOverAt: true,
    shippedAt: true,
    deliveredAt: true,
  };
}

async function getFreshProducts(tx, productIds) {
  return tx.product.findMany({
    where: {
      id: {
        in: productIds,
      },
      deletedAt: null,
      isPublished: true,
    },

    select: ORDER_PRODUCT_SELECT,
  });
}

function calculateProductSubtotal(cartItems, productMap) {
  let subtotal = 0;

  for (const item of cartItems) {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new Error(
        `Product ${item.productId} is missing`
      );
    }

    const financial =
      getProductFinancialSnapshot(product);

    const lineTotal =
      financial.price * item.quantity;

    if (
      !Number.isSafeInteger(lineTotal) ||
      !Number.isSafeInteger(subtotal + lineTotal)
    ) {
      throw new PricingError(
        "INVALID_ORDER_TOTAL",
        "مبلغ سفارش معتبر نیست."
      );
    }

    subtotal += lineTotal;
  }

  return subtotal;
}

function getProductMap(products) {
  return new Map(
    products.map((product) => [
      product.id,
      product,
    ])
  );
}

function getCouponOrderData(benefits) {
  return {
    couponId: benefits.couponId,
    couponCode: benefits.couponCode,
    couponType: benefits.couponType,
    couponDiscount: benefits.couponDiscount,
    couponShippingDiscount:
      benefits.couponShippingDiscount,
  };
}

function calculateRequiredAmount(
  productSubtotal,
  shippingCost,
  benefits
) {
  const requiredAmount =
    productSubtotal -
    benefits.couponDiscount +
    shippingCost -
    benefits.couponShippingDiscount;

  if (
    !Number.isSafeInteger(requiredAmount) ||
    requiredAmount <= 0 ||
    requiredAmount > MAX_DB_INT
  ) {
    throw new PricingError(
      "INVALID_ORDER_TOTAL",
      "مبلغ نهایی سفارش معتبر نیست."
    );
  }

  return requiredAmount;
}

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
        paymentStatus: {
          in: ["PAID", "PENDING"],
        },
      },

      omit: {
        authority: true,
        stockIssueAt: true,
      },

      take: 100,

      orderBy: {
        createdAt: "desc",
      },

      include: {
        items: {
          include: {
            product: {
              include: {
                images: true,
              },
            },
          },
        },

        fulfillments: {
          orderBy: {
            createdAt: "asc",
          },

          select: {
            id: true,
            status: true,
            shippingMethod: true,
            shippingCost: true,
            shippingDiscount: true,
            trackingCode: true,
            trackingCodeAddedAt: true,
            handedOverAt: true,
            shippedAt: true,
            deliveredAt: true,
            createdAt: true,
            updatedAt: true,

            items: {
              select: {
                id: true,
                quantity: true,

                orderItem: {
                  select: {
                    id: true,
                    productId: true,
                    price: true,

                    product: {
                      select: {
                        id: true,
                        title: true,
                        image: true,
                        images: {
                          select: {
                            id: true,
                            url: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(
      normalizeOrderProducts(orders),
    );
  } catch (error) {
    console.error("GET_ORDERS_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت سفارش‌ها" },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لطفاً وارد حساب کاربری شوید" },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "اطلاعات سفارش معتبر نیست",
        },
        { status: 400 },
      );
    }

    const {
      receiverName,
      receiverPhone,
      provinceId,
      cityId,
      address,
      postalCode,
      requiresPrintedInvoice,
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
        { status: 400 },
      );
    }

    const { province, city } = location;

    // دریافت سبد خرید واقعی از دیتابیس
    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
      },

      include: {
        product: {
          select: ORDER_PRODUCT_SELECT,
        },
      },
    });

    if (!cartItems.length) {
      return NextResponse.json(
        { error: "سبد خرید خالی است" },
        { status: 400 },
      );
    }

    // پاک‌سازی محصولات آرشیوشده
    const archivedItems = cartItems.filter(
      (item) =>
        !item.product ||
        item.product.deletedAt !== null
    );

    if (archivedItems.length > 0) {
      const archivedProductIds = archivedItems.map(
        (item) => item.productId
      );

      await prisma.cartItem.deleteMany({
        where: {
          userId: user.id,
          productId: {
            in: archivedProductIds,
          },
        },
      });

      return NextResponse.json(
        {
          error:
            "بعضی از کالاهای سبد خرید آرشیو شده‌اند و از سبد حذف شدند. لطفاً سبد خرید را دوباره بررسی کنید.",
          archivedProductIds,
        },
        { status: 409 },
      );
    }

    // اعتبارسنجی اولیه تعداد، انتشار و قیمت
    for (const item of cartItems) {
      if (
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > MAX_QUANTITY_PER_ITEM
      ) {
        return NextResponse.json(
          {
            error: `تعداد یکی از کالاها معتبر نیست. حداکثر تعداد هر کالا ${MAX_QUANTITY_PER_ITEM} است.`,
          },
          { status: 400 },
        );
      }

      if (!item.product.isPublished) {
        return NextResponse.json(
          {
            error: `کالای «${item.product.title}» در حال حاضر قابل خرید نیست.`,
          },
          { status: 409 },
        );
      }

      getProductFinancialSnapshot(item.product);
    }

    // گروه‌بندی مرسوله‌ها بر اساس مالک واقعی محصولات
    const initialGroups = buildFulfillmentGroups(
      cartItems,
      (item) => item.product
    );

    const fulfillmentGroups = applyShippingMethods(
      initialGroups,
      shippingMethodsBySeller
    );

    if (!fulfillmentGroups) {
      return NextResponse.json(
        {
          error:
            "روش ارسال برای همه مرسوله‌ها انتخاب نشده یا انتخاب‌های ارسالی با سبد خرید هماهنگ نیست. لطفاً سبد خرید را تازه‌سازی و دوباره بررسی کنید.",
        },
        { status: 400 },
      );
    }

    const productMap = getProductMap(
      cartItems.map((item) => item.product)
    );

    const productSubtotal = calculateProductSubtotal(
      cartItems,
      productMap
    );

    const shippingCost = getTotalShippingCost(
      fulfillmentGroups
    );

    // اعتبارسنجی واقعی کوپن از دیتابیس
    const couponBenefits = await resolveCouponBenefits(
      prisma,
      {
        couponCode,
        productSubtotalToman: productSubtotal,
        shippingCostToman: shippingCost,
      }
    );

    const requiredAmountToman = calculateRequiredAmount(
      productSubtotal,
      shippingCost,
      couponBenefits
    );

    // محاسبه کارمزد درگاه روی مبلغ پس از تخفیف
    const paymentQuote =
      await calculateZarinpalPaymentAmount(
        requiredAmountToman
      );

    const gatewayFee = paymentQuote.gatewayFeeToman;
    const total = paymentQuote.totalAmountToman;

    if (
      !Number.isSafeInteger(gatewayFee) ||
      gatewayFee < 0 ||
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      total > MAX_DB_INT ||
      total !== requiredAmountToman + gatewayFee
    ) {
      throw new PricingError(
        "INVALID_PAYMENT_TOTAL",
        "مبلغ نهایی پرداخت معتبر نیست."
      );
    }

    const checkoutData = {
      receiverName,
      receiverPhone,
      provinceId: province.id,
      cityId: city.id,
      address,
      postalCode,
      requiresPrintedInvoice,
      cartItems,
      fulfillmentGroups,
      shippingCost,
      gatewayFee,
      total,

      ...couponBenefits,
    };

    // آخرین سفارش پرداخت‌نشده کاربر
    const pendingOrder = await prisma.order.findFirst({
      where: {
        userId: user.id,
        paymentStatus: "PENDING",
        status: "PENDING",
      },

      orderBy: {
        createdAt: "desc",
      },

      include: {
        items: true,
        transaction: true,
        fulfillments: {
          select: getOrderFulfillmentSelect(),
        },
      },
    });

    if (pendingOrder) {
      const sameCheckout = isSameCheckout(
        pendingOrder,
        checkoutData
      );

      const hasSupplierSnapshot =
        hasCompleteSupplierSnapshot(pendingOrder.items);

      // سفارش دارای رزرو فعال نباید تغییر کند.
      if (
        pendingOrder.stockReservationStatus === "RESERVED"
      ) {
        if (
          pendingOrder.transaction?.status === "PENDING" &&
          pendingOrder.authority &&
          sameCheckout
        ) {
          if (!hasSupplierSnapshot) {
            return NextResponse.json(
              {
                error:
                  "Snapshot مالی یا مالکیت کالاهای این سفارش ناقص است و پرداخت آن نیازمند بررسی پشتیبانی است.",
              },
              { status: 409 },
            );
          }

          return NextResponse.json({
            success: true,
            orderId: pendingOrder.id,
            reused: true,
            reservationActive: true,
          });
        }

        return NextResponse.json(
          {
            error:
              "برای این سفارش رزرو موجودی فعال وجود دارد. ابتدا وضعیت پرداخت قبلی باید مشخص شود.",
          },
          { status: 409 },
        );
      }

      if (
        ["ISSUE", "CONSUMED"].includes(
          pendingOrder.stockReservationStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              "وضعیت رزرو سفارش نیازمند بررسی است. لطفاً با پشتیبانی تماس بگیرید.",
          },
          { status: 409 },
        );
      }

      if (
        pendingOrder.transaction?.status === "PENDING"
      ) {
        return NextResponse.json(
          {
            error:
              "یک پرداخت فعال برای سفارش قبلی وجود دارد که وضعیت رزرو آن مشخص نیست. لطفاً با پشتیبانی تماس بگیرید.",
          },
          { status: 409 },
        );
      }

      if (
        pendingOrder.transaction?.status === "SUCCESS"
      ) {
        return NextResponse.json(
          {
            error:
              "تراکنش قبلی موفق بوده اما وضعیت سفارش پرداخت‌شده نیست. لطفاً با پشتیبانی تماس بگیرید.",
          },
          { status: 409 },
        );
      }

      if (
        pendingOrder.authority &&
        !pendingOrder.transaction
      ) {
        return NextResponse.json(
          {
            error:
              "اطلاعات پرداخت سفارش قبلی ناقص است و نیاز به بررسی دارد.",
          },
          { status: 409 },
        );
      }

      if (sameCheckout && hasSupplierSnapshot) {
        return NextResponse.json({
          success: true,
          orderId: pendingOrder.id,
          reused: true,
        });
      }
    }

    // بررسی اولیه موجودی آزاد
    for (const item of cartItems) {
      const availableStock = getAvailableStock(
        item.product
      );

      if (item.quantity > availableStock) {
        return NextResponse.json(
          {
            error: `از کالای «${item.product.title}» فقط ${availableStock} عدد قابل خرید است.`,
            productId: item.productId,
            availableStock,
          },
          { status: 409 },
        );
      }
    }

    // بازسازی سفارش پرداخت‌نشده قبلی
    if (pendingOrder) {
      const updateResult = await prisma.$transaction(
        async (tx) => {
          await lockUser(tx, user.id);

          const lockedRows = await tx.$queryRaw`
            SELECT "id"
            FROM "Order"
            WHERE "id" = ${pendingOrder.id}
              AND "userId" = ${user.id}
            FOR UPDATE
          `;

          if (!lockedRows.length) {
            return { type: "STATE_CHANGED" };
          }

          const currentOrder = await tx.order.findUnique({
            where: {
              id: pendingOrder.id,
            },

            include: {
              items: true,
              transaction: true,
              fulfillments: {
                select: getOrderFulfillmentSelect(),
              },
            },
          });

          if (
            !currentOrder ||
            currentOrder.paymentStatus !== "PENDING" ||
            currentOrder.status !== "PENDING" ||
            currentOrder.stockReservationStatus === "RESERVED" ||
            ["CONSUMED", "ISSUE"].includes(
              currentOrder.stockReservationStatus
            ) ||
            currentOrder.transaction?.status === "PENDING" ||
            currentOrder.transaction?.status === "SUCCESS" ||
            (
              currentOrder.authority &&
              !currentOrder.transaction
            )
          ) {
            return { type: "STATE_CHANGED" };
          }

          const hasOperationalFulfillment =
            currentOrder.fulfillments.some(
              (fulfillment) =>
                fulfillment.status !== "PREPARING" ||
                fulfillment.trackingCode ||
                fulfillment.handedOverAt ||
                fulfillment.shippedAt ||
                fulfillment.deliveredAt
            );

          if (hasOperationalFulfillment) {
            return { type: "FULFILLMENT_STARTED" };
          }

          const productIds = getSortedProductIds(
            cartItems
          );

          await lockProducts(tx, productIds);

          const freshProducts = await getFreshProducts(
            tx,
            productIds
          );

          const freshProductMap = getProductMap(
            freshProducts
          );

          const freshCartItems = cartItems.map((item) => ({
            ...item,
            product: freshProductMap.get(item.productId),
          }));

          for (const item of freshCartItems) {
            const product = item.product;

            if (
              !product ||
              item.quantity > getAvailableStock(product)
            ) {
              return {
                type: "STOCK_CHANGED",
                productId: item.productId,
              };
            }

            const financial =
              getProductFinancialSnapshot(product);

            const oldProduct = cartItems.find(
              (cartItem) =>
                cartItem.productId === item.productId
            )?.product;

            if (
              financial.price !== Number(oldProduct?.price)
            ) {
              return {
                type: "PRICE_CHANGED",
                productId: item.productId,
              };
            }
          }

          const freshGroups = buildFulfillmentGroups(
            freshCartItems,
            (item) => item.product
          );

          if (
            !hasSameSellerGroups(
              initialGroups,
              freshGroups
            )
          ) {
            return {
              type: "SELLER_CHANGED",
            };
          }

          const freshFulfillmentGroups =
            applyShippingMethods(
              freshGroups,
              shippingMethodsBySeller
            );

          if (!freshFulfillmentGroups) {
            return {
              type: "SHIPPING_CHANGED",
            };
          }

          const freshProductSubtotal =
            calculateProductSubtotal(
              freshCartItems,
              freshProductMap
            );

          const freshShippingCost =
            getTotalShippingCost(
              freshFulfillmentGroups
            );

          // اعتبارسنجی مجدد کوپن در همان تراکنش
          const freshCouponBenefits =
            await resolveCouponBenefits(tx, {
              couponCode,
              productSubtotalToman: freshProductSubtotal,
              shippingCostToman: freshShippingCost,
            });

          const couponUnchanged = hasSameCouponBenefits(
            freshCouponBenefits,
            couponBenefits
          );

          const freshRequiredAmount =
            calculateRequiredAmount(
              freshProductSubtotal,
              freshShippingCost,
              freshCouponBenefits
            );

          const freshTotal =
            freshRequiredAmount + gatewayFee;

          if (
            !couponUnchanged ||
            !Number.isSafeInteger(freshTotal) ||
            freshTotal > MAX_DB_INT ||
            freshRequiredAmount !== requiredAmountToman ||
            freshTotal !== total ||
            freshShippingCost !== shippingCost
          ) {
            return {
              type: couponUnchanged
                ? "TOTAL_CHANGED"
                : "COUPON_CHANGED",
            };
          }

          // حذف مرسوله‌ها و سپس اقلام قبلی
          await tx.orderFulfillment.deleteMany({
            where: {
              orderId: pendingOrder.id,
            },
          });

          await tx.orderItem.deleteMany({
            where: {
              orderId: pendingOrder.id,
            },
          });

          const order = await tx.order.update({
            where: {
              id: pendingOrder.id,
            },

            data: {
              receiverName,
              receiverPhone,

              provinceId: province.id,
              provinceName: province.name,

              cityId: city.id,
              cityName: city.name,

              address,
              postalCode,
              requiresPrintedInvoice,

              shippingMethod:
                getLegacyOrderShippingMethod(
                  freshFulfillmentGroups
                ),

              shippingCost: freshShippingCost,
              gatewayFee,
              total: freshTotal,

              ...getCouponOrderData(freshCouponBenefits),

              status: "PENDING",
              paymentStatus: "PENDING",

              authority: null,
              refId: null,
              paidAt: null,
              paymentExpiresAt: null,
              stockIssueAt: null,
            },
          });

          await createOrderItemsAndFulfillments(
            tx,
            {
              orderId: order.id,
              cartItems: freshCartItems,
              productMap: freshProductMap,
              shippingMethodsBySeller,
              couponShippingDiscount:
                freshCouponBenefits.couponShippingDiscount,
            }
          );

          return {
            type: "UPDATED",
            order,
          };
        }
      );

      if (
        updateResult.type === "STATE_CHANGED" ||
        updateResult.type === "FULFILLMENT_STARTED"
      ) {
        return NextResponse.json(
          {
            error:
              "وضعیت سفارش یا مرسوله‌ها هم‌زمان تغییر کرده است. صفحه را تازه‌سازی و دوباره تلاش کنید.",
          },
          { status: 409 },
        );
      }

      if (updateResult.type === "COUPON_CHANGED") {
        return NextResponse.json(
          {
            error:
              "اطلاعات کد تخفیف هنگام ثبت سفارش تغییر کرده است. لطفاً دوباره پیش‌فاکتور بگیر.",
          },
          { status: 409 },
        );
      }

      if (
        updateResult.type === "STOCK_CHANGED" ||
        updateResult.type === "PRICE_CHANGED" ||
        updateResult.type === "TOTAL_CHANGED" ||
        updateResult.type === "SELLER_CHANGED" ||
        updateResult.type === "SHIPPING_CHANGED"
      ) {
        return NextResponse.json(
          {
            error:
              "موجودی، قیمت یا اطلاعات فروشنده یکی از کالاها تغییر کرده است. لطفاً سبد خرید را تازه‌سازی و دوباره بررسی کنید.",
            productId: updateResult.productId,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({
        success: true,
        orderId: updateResult.order.id,
        reused: true,
      });
    }

    // ایجاد سفارش جدید
    const createResult = await prisma.$transaction(
      async (tx) => {
        await lockUser(tx, user.id);

        const concurrentPendingOrder =
          await tx.order.findFirst({
            where: {
              userId: user.id,
              paymentStatus: "PENDING",
              status: "PENDING",
            },

            select: {
              id: true,
            },
          });

        if (concurrentPendingOrder) {
          return {
            type: "PENDING_EXISTS",
            orderId: concurrentPendingOrder.id,
          };
        }

        const productIds = getSortedProductIds(
          cartItems
        );

        await lockProducts(tx, productIds);

        const freshProducts = await getFreshProducts(
          tx,
          productIds
        );

        const freshProductMap = getProductMap(
          freshProducts
        );

        const freshCartItems = cartItems.map((item) => ({
          ...item,
          product: freshProductMap.get(item.productId),
        }));

        for (const item of freshCartItems) {
          const product = item.product;

          if (
            !product ||
            item.quantity > getAvailableStock(product)
          ) {
            return {
              type: "STOCK_CHANGED",
              productId: item.productId,
            };
          }

          const financial =
            getProductFinancialSnapshot(product);

          const oldProduct = cartItems.find(
            (cartItem) =>
              cartItem.productId === item.productId
          )?.product;

          if (
            financial.price !== Number(oldProduct?.price)
          ) {
            return {
              type: "PRICE_CHANGED",
              productId: item.productId,
            };
          }
        }

        const freshGroups = buildFulfillmentGroups(
          freshCartItems,
          (item) => item.product
        );

        if (
          !hasSameSellerGroups(
            initialGroups,
            freshGroups
          )
        ) {
          return {
            type: "SELLER_CHANGED",
          };
        }

        const freshFulfillmentGroups =
          applyShippingMethods(
            freshGroups,
            shippingMethodsBySeller
          );

        if (!freshFulfillmentGroups) {
          return {
            type: "SHIPPING_CHANGED",
          };
        }

        const freshProductSubtotal =
          calculateProductSubtotal(
            freshCartItems,
            freshProductMap
          );

        const freshShippingCost =
          getTotalShippingCost(
            freshFulfillmentGroups
          );

        // اعتبارسنجی مجدد کوپن در تراکنش ساخت سفارش
        const freshCouponBenefits =
          await resolveCouponBenefits(tx, {
            couponCode,
            productSubtotalToman: freshProductSubtotal,
            shippingCostToman: freshShippingCost,
          });

        const couponUnchanged = hasSameCouponBenefits(
          freshCouponBenefits,
          couponBenefits
        );

        const freshRequiredAmount =
          calculateRequiredAmount(
            freshProductSubtotal,
            freshShippingCost,
            freshCouponBenefits
          );

        const freshTotal =
          freshRequiredAmount + gatewayFee;

        if (
          !couponUnchanged ||
          !Number.isSafeInteger(freshTotal) ||
          freshTotal > MAX_DB_INT ||
          freshRequiredAmount !== requiredAmountToman ||
          freshTotal !== total ||
          freshShippingCost !== shippingCost
        ) {
          return {
            type: couponUnchanged
              ? "TOTAL_CHANGED"
              : "COUPON_CHANGED",
          };
        }

        const order = await tx.order.create({
          data: {
            userId: user.id,

            receiverName,
            receiverPhone,

            provinceId: province.id,
            provinceName: province.name,

            cityId: city.id,
            cityName: city.name,

            address,
            postalCode,
            requiresPrintedInvoice,

            shippingMethod:
              getLegacyOrderShippingMethod(
                freshFulfillmentGroups
              ),

            shippingCost: freshShippingCost,
            gatewayFee,
            total: freshTotal,

            ...getCouponOrderData(freshCouponBenefits),

            status: "PENDING",
            paymentStatus: "PENDING",
          },
        });

        await createOrderItemsAndFulfillments(
          tx,
          {
            orderId: order.id,
            cartItems: freshCartItems,
            productMap: freshProductMap,
            shippingMethodsBySeller,
            couponShippingDiscount:
              freshCouponBenefits.couponShippingDiscount,
          }
        );

        return {
          type: "CREATED",
          order,
        };
      }
    );

    if (createResult.type === "PENDING_EXISTS") {
      return NextResponse.json(
        {
          error:
            "یک سفارش پرداخت‌نشده دیگر برای حساب شما ثبت شده است. صفحه را تازه‌سازی و سفارش قبلی را بررسی کنید.",
          orderId: createResult.orderId,
        },
        { status: 409 },
      );
    }

    if (createResult.type === "COUPON_CHANGED") {
      return NextResponse.json(
        {
          error:
            "اطلاعات کد تخفیف هنگام ثبت سفارش تغییر کرده است. لطفاً دوباره پیش‌فاکتور بگیر.",
        },
        { status: 409 },
      );
    }

    if (
      createResult.type === "STOCK_CHANGED" ||
      createResult.type === "PRICE_CHANGED" ||
      createResult.type === "TOTAL_CHANGED" ||
      createResult.type === "SELLER_CHANGED" ||
      createResult.type === "SHIPPING_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "موجودی، قیمت یا اطلاعات فروشنده یکی از کالاها تغییر کرده است. لطفاً سبد خرید را تازه‌سازی و دوباره بررسی کنید.",
          productId: createResult.productId,
        },
        { status: 409 },
      );
    }

    const order = createResult.order;

    await logAction({
      userId: user.id,
      action: "CREATE_ORDER",
      entityType: "ORDER",
      entityId: String(order.id),
      description: `سفارش #${order.id} ثبت شد`,
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
    });
  } catch (error) {
    console.error("CREATE_ORDER_ERROR", {
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
      { error: "خطا در ثبت سفارش" },
      { status: 500 },
    );
  }
}
