
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoles } from "@/lib/auth";
import { PaymentStatus, OrderStatus } from "@/generated/prisma";

const SHIPPING_METHOD_LABELS = {
  POST: "پست عادی",
  POST_EXPRESS: "پست پیشتاز",
};

function responseError(error, status) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function isSafeAmount(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) >= 0;
}

/**
 * تقسیم تخفیف کالاهای سفارش بین مرسوله‌ها.
 *
 * روش بزرگ‌ترین باقیمانده تضمین می‌کند مجموع سهم‌ها
 * دقیقاً برابر تخفیف کل سفارش باشد.
 */
function allocateDiscount(totalDiscount, groups) {
  const totalSubtotal = groups.reduce(
    (sum, group) => sum + group.subtotal,
    0,
  );

  if (
    !Number.isSafeInteger(totalSubtotal) ||
    totalSubtotal <= 0 ||
    !Number.isSafeInteger(totalDiscount) ||
    totalDiscount < 0 ||
    totalDiscount > totalSubtotal
  ) {
    return null;
  }

  const discount = BigInt(totalDiscount);
  const denominator = BigInt(totalSubtotal);

  const allocations = groups.map((group) => {
    const numerator = discount * BigInt(group.subtotal);

    return {
      sellerKey: group.sellerKey,
      amount: Number(numerator / denominator),
      remainder: numerator % denominator,
    };
  });

  const allocatedTotal = allocations.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  const remaining = totalDiscount - allocatedTotal;

  const ranked = [...allocations].sort((a, b) => {
    if (a.remainder > b.remainder) return -1;
    if (a.remainder < b.remainder) return 1;

    return a.sellerKey.localeCompare(b.sellerKey);
  });

  for (let i = 0; i < remaining; i++) {
    ranked[i].amount += 1;
  }

  return new Map(
    allocations.map((item) => [
      item.sellerKey,
      item.amount,
    ]),
  );
}

export async function GET(req, { params }) {
  const auth = await requireRoles(["ADMIN", "SUPPLIER"]);

  if (auth.error) {
    return auth.error;
  }

  try {
    const { id: rawId } = await params;
    const fulfillmentId = String(rawId ?? "").trim();

    if (!fulfillmentId || fulfillmentId.length > 128) {
      return responseError("شناسه مرسوله معتبر نیست.", 400);
    }

    const isAdmin = auth.user.role === "ADMIN";

    // تأمین‌کننده فقط مرسوله متعلق به خودش را دریافت می‌کند.
    const fulfillment = await prisma.orderFulfillment.findFirst({
      where: {
        id: fulfillmentId,
        ...(!isAdmin
          ? { supplierId: auth.user.id }
          : {}),
      },

      select: {
        id: true,
        orderId: true,
        supplierId: true,
        sellerKey: true,
        status: true,
        shippingMethod: true,
        shippingCost: true,
        shippingDiscount: true,
        trackingCode: true,
        createdAt: true,

        supplier: {
          select: {
            id: true,
            name: true,
          },
        },

        items: {
          select: {
            id: true,
            quantity: true,

            orderItem: {
              select: {
                id: true,
                productId: true,
                quantity: true,
                price: true,
                supplierId: true,
                supplierSnapshotCaptured: true,
                originalPriceAtPurchase: true,

                product: {
                  select: {
                    id: true,
                    title: true,
                  },
                },
              },
            },
          },
        },

        order: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            requiresPrintedInvoice: true,
            createdAt: true,
            paidAt: true,
            refId: true,
            total: true,
            shippingCost: true,
            couponCode: true,
            couponType: true,
            couponDiscount: true,
            couponShippingDiscount: true,

            receiverName: true,
            receiverPhone: true,
            provinceName: true,
            cityName: true,
            address: true,
            postalCode: true,

            transaction: {
              select: {
                refId: true,
                status: true,
              },
            },

            // فقط برای محاسبه سهم تخفیف در سرور.
            items: {
              select: {
                id: true,
                quantity: true,
                price: true,
              },
            },

            // اطلاعات همه مرسوله‌ها برای کنترل و تخصیص تخفیف.
            fulfillments: {
              select: {
                id: true,
                sellerKey: true,
                supplierId: true,
                shippingCost: true,
                shippingDiscount: true,

                items: {
                  select: {
                    quantity: true,

                    orderItem: {
                      select: {
                        id: true,
                        quantity: true,
                        price: true,
                        supplierId: true,
                        supplierSnapshotCaptured: true,
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

    if (!fulfillment) {
      return responseError("مرسوله پیدا نشد.", 404);
    }

    const order = fulfillment.order;

    if (
      order.paymentStatus !== PaymentStatus.PAID ||
      order.status === OrderStatus.CANCELLED
    ) {
      return responseError(
        "فاکتور فقط برای سفارش پرداخت‌شده و لغونشده قابل دریافت است.",
        409,
      );
    }

    if (!order.requiresPrintedInvoice) {
      return responseError(
        "مشتری برای این سفارش درخواست فاکتور چاپی نکرده است.",
        403,
      );
    }

    if (
      fulfillment.status === "ISSUE" ||
      !fulfillment.items?.length ||
      !order.items?.length ||
      !order.fulfillments?.length
    ) {
      return responseError(
        "اطلاعات این مرسوله برای تولید فاکتور کامل نیست.",
        409,
      );
    }

    const expectedSellerKey = fulfillment.supplierId
      ? `SUPPLIER:${fulfillment.supplierId}`
      : "BORJAK";

    if (fulfillment.sellerKey !== expectedSellerKey) {
      return responseError(
        "مالکیت مرسوله با اطلاعات سفارش هماهنگ نیست.",
        409,
      );
    }

    if (
      !isSafeAmount(fulfillment.shippingCost) ||
      !isSafeAmount(fulfillment.shippingDiscount) ||
      fulfillment.shippingDiscount > fulfillment.shippingCost ||
      !SHIPPING_METHOD_LABELS[fulfillment.shippingMethod]
    ) {
      return responseError(
        "اطلاعات ارسال مرسوله معتبر نیست.",
        409,
      );
    }

    // کنترل ارتباط کالاهای سفارش و مرسوله‌ها.
    const orderItemsById = new Map(
      order.items.map((item) => [item.id, item]),
    );

    const seenOrderItemIds = new Set();
    const groups = [];

    for (const group of order.fulfillments) {
      const ownerKey = group.supplierId
        ? `SUPPLIER:${group.supplierId}`
        : "BORJAK";

      if (
        group.sellerKey !== ownerKey ||
        !isSafeAmount(group.shippingCost) ||
        !isSafeAmount(group.shippingDiscount) ||
        group.shippingDiscount > group.shippingCost ||
        !group.items?.length
      ) {
        return responseError(
          "اطلاعات یکی از مرسوله‌های سفارش معتبر نیست.",
          409,
        );
      }

      let subtotal = 0;

      for (const fulfillmentItem of group.items) {
        const item = fulfillmentItem.orderItem;
        const originalItem = orderItemsById.get(item.id);

        if (
          !originalItem ||
          seenOrderItemIds.has(item.id) ||
          item.supplierSnapshotCaptured !== true ||
          (item.supplierId ?? null) !==
            (group.supplierId ?? null) ||
          fulfillmentItem.quantity !== item.quantity ||
          fulfillmentItem.quantity !== originalItem.quantity ||
          !Number.isSafeInteger(item.price) ||
          item.price < 0 ||
          !Number.isSafeInteger(fulfillmentItem.quantity) ||
          fulfillmentItem.quantity <= 0
        ) {
          return responseError(
            "Snapshot یا ارتباط کالاهای مرسوله معتبر نیست.",
            409,
          );
        }

        seenOrderItemIds.add(item.id);

        const lineTotal = item.price * fulfillmentItem.quantity;

        if (
          !Number.isSafeInteger(lineTotal) ||
          !Number.isSafeInteger(subtotal + lineTotal)
        ) {
          return responseError(
            "مبلغ کالاهای مرسوله معتبر نیست.",
            409,
          );
        }

        subtotal += lineTotal;
      }

      groups.push({
        id: group.id,
        sellerKey: group.sellerKey,
        supplierId: group.supplierId,
        subtotal,
        shippingCost: Number(group.shippingCost),
        shippingDiscount: Number(group.shippingDiscount),
      });
    }

    if (seenOrderItemIds.size !== order.items.length) {
      return responseError(
        "همه کالاهای سفارش به مرسوله متصل نیستند.",
        409,
      );
    }

    // محاسبه جمع کالاهای سفارش از Snapshot سفارش.
    const orderProductSubtotal = order.items.reduce(
      (sum, item) => {
        if (
          !Number.isSafeInteger(item.price) ||
          item.price < 0 ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity <= 0
        ) {
          return NaN;
        }

        const lineTotal = item.price * item.quantity;

        if (
          !Number.isSafeInteger(lineTotal) ||
          !Number.isSafeInteger(sum + lineTotal)
        ) {
          return NaN;
        }

        return sum + lineTotal;
      },
      0,
    );

    const fulfillmentSubtotal = groups.reduce(
      (sum, group) => sum + group.subtotal,
      0,
    );

    if (
      !Number.isSafeInteger(orderProductSubtotal) ||
      orderProductSubtotal <= 0 ||
      !Number.isSafeInteger(fulfillmentSubtotal) ||
      fulfillmentSubtotal !== orderProductSubtotal
    ) {
      return responseError(
        "جمع کالاهای سفارش با مرسوله‌ها هماهنگ نیست.",
        409,
      );
    }

    // کنترل مجموع هزینه ارسال و تخفیف ارسال مرسوله‌ها.
    const totalShippingCost = groups.reduce(
      (sum, group) => sum + group.shippingCost,
      0,
    );

    const totalShippingDiscount = groups.reduce(
      (sum, group) => sum + group.shippingDiscount,
      0,
    );

    const orderShippingCost = Number(order.shippingCost ?? 0);
    const couponShippingDiscount = Number(
      order.couponShippingDiscount ?? 0,
    );

    if (
      !Number.isSafeInteger(totalShippingCost) ||
      !Number.isSafeInteger(totalShippingDiscount) ||
      !isSafeAmount(orderShippingCost) ||
      !isSafeAmount(couponShippingDiscount) ||
      totalShippingCost !== orderShippingCost ||
      totalShippingDiscount !== couponShippingDiscount
    ) {
      return responseError(
        "جمع هزینه یا تخفیف ارسال مرسوله‌ها با Snapshot سفارش هماهنگ نیست.",
        409,
      );
    }

    // کنترل Snapshot کوپن فروشگاه.
    const couponDiscount = Number(order.couponDiscount ?? 0);
    const couponCode =
      typeof order.couponCode === "string"
        ? order.couponCode.trim()
        : "";

    const couponType = order.couponType ?? null;

    if (
      !Number.isSafeInteger(couponDiscount) ||
      couponDiscount < 0 ||
      couponDiscount > orderProductSubtotal
    ) {
      return responseError(
        "مبلغ تخفیف سفارش با جمع کالاها هماهنگ نیست.",
        409,
      );
    }

    if (couponType === null) {
      if (
        couponCode ||
        couponDiscount !== 0 ||
        couponShippingDiscount !== 0
      ) {
        return responseError(
          "اطلاعات Snapshot کوپن سفارش معتبر نیست.",
          409,
        );
      }
    } else if (couponType === "FREE_SHIPPING") {
      if (
        !couponCode ||
        couponDiscount !== 0 ||
        couponShippingDiscount <= 0 ||
        couponShippingDiscount !== totalShippingCost ||
        groups.some(
          (group) =>
            group.shippingDiscount !== group.shippingCost,
        )
      ) {
        return responseError(
          "اطلاعات کوپن ارسال رایگان با مرسوله‌ها هماهنگ نیست.",
          409,
        );
      }
    } else if (
      couponType === "PERCENTAGE" ||
      couponType === "FIXED"
    ) {
      if (
        !couponCode ||
        couponDiscount <= 0 ||
        couponShippingDiscount !== 0 ||
        groups.some((group) => group.shippingDiscount !== 0)
      ) {
        return responseError(
          "اطلاعات تخفیف کالا با Snapshot مرسوله‌ها هماهنگ نیست.",
          409,
        );
      }
    } else {
      return responseError(
        "نوع کوپن سفارش معتبر نیست.",
        409,
      );
    }

    // تقسیم تخفیف کالاهای فروشگاه بین مرسوله‌ها.
    const discountAllocations = allocateDiscount(
      couponDiscount,
      groups,
    );

    if (!discountAllocations) {
      return responseError(
        "محاسبه سهم تخفیف مرسوله‌ها ممکن نیست.",
        409,
      );
    }

    const currentGroup = groups.find(
      (group) => group.id === fulfillment.id,
    );

    if (!currentGroup) {
      return responseError(
        "مرسوله در ساختار سفارش پیدا نشد.",
        409,
      );
    }

    // کنترل تطابق اطلاعات مرسوله جاری با اطلاعات سفارش.
    if (
      Number(fulfillment.shippingCost) !==
        currentGroup.shippingCost ||
      Number(fulfillment.shippingDiscount) !==
        currentGroup.shippingDiscount
    ) {
      return responseError(
        "اطلاعات هزینه ارسال این مرسوله با سفارش هماهنگ نیست.",
        409,
      );
    }

    // شماره ثابت مرسوله در سفارش.
    const sortedGroups = [...groups].sort(
      (a, b) => a.sellerKey.localeCompare(b.sellerKey),
    );

    const shipmentIndex = sortedGroups.findIndex(
      (group) => group.id === fulfillment.id,
    );

    if (shipmentIndex < 0) {
      return responseError(
        "شماره مرسوله قابل محاسبه نیست.",
        409,
      );
    }

    // ردیف‌های کالا در فاکتور همین مرسوله.
    const productLines = [];

    for (const fulfillmentItem of fulfillment.items) {
      const item = fulfillmentItem.orderItem;
      const quantity = fulfillmentItem.quantity;

      const unitPrice = Number(item.price);
      const unitOriginalPrice = Number(
        item.originalPriceAtPurchase ?? item.price,
      );

      if (
        !Number.isSafeInteger(unitPrice) ||
        unitPrice < 0 ||
        !Number.isSafeInteger(unitOriginalPrice) ||
        unitOriginalPrice < unitPrice ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0
      ) {
        return responseError(
          "اطلاعات قیمت یکی از کالاهای فاکتور معتبر نیست.",
          409,
        );
      }

      const unitDiscount = unitOriginalPrice - unitPrice;
      const originalTotal = unitOriginalPrice * quantity;
      const discountTotal = unitDiscount * quantity;
      const lineTotal = unitPrice * quantity;

      if (
        !Number.isSafeInteger(originalTotal) ||
        !Number.isSafeInteger(discountTotal) ||
        !Number.isSafeInteger(lineTotal)
      ) {
        return responseError(
          "مبلغ یکی از ردیف‌های فاکتور معتبر نیست.",
          409,
        );
      }

      productLines.push({
        id: item.id,
        productId: item.productId,
        title: item.product?.title || "کالای سفارش",

        quantity,

        unitOriginalPrice,
        unitDiscount,
        unitPrice,

        originalTotal,
        discountTotal,
        lineTotal,
      });
    }

    const productSubtotal = productLines.reduce(
      (sum, line) => sum + line.lineTotal,
      0,
    );

    const productDiscountTotal = productLines.reduce(
      (sum, line) => sum + line.discountTotal,
      0,
    );

    const originalSubtotal =
      productSubtotal + productDiscountTotal;

    const storeDiscountShare =
      discountAllocations.get(fulfillment.sellerKey) ?? 0;

    const shippingCost = Number(fulfillment.shippingCost);
    const shippingDiscount = Number(
      fulfillment.shippingDiscount,
    );

    const finalShippingCost =
      shippingCost - shippingDiscount;

    const finalProductSubtotal =
      productSubtotal - storeDiscountShare;

    const invoiceTotal =
      finalProductSubtotal + finalShippingCost;

    if (
      !Number.isSafeInteger(productSubtotal) ||
      productSubtotal !== currentGroup.subtotal ||
      !Number.isSafeInteger(productDiscountTotal) ||
      !Number.isSafeInteger(originalSubtotal) ||
      !Number.isSafeInteger(storeDiscountShare) ||
      storeDiscountShare < 0 ||
      storeDiscountShare > productSubtotal ||
      !Number.isSafeInteger(finalShippingCost) ||
      finalShippingCost < 0 ||
      !Number.isSafeInteger(invoiceTotal) ||
      invoiceTotal < 0
    ) {
      return responseError(
        "جمع فاکتور مرسوله معتبر نیست.",
        409,
      );
    }

    return NextResponse.json(
      {
        success: true,

        invoice: {
          invoiceNumber:
            `${order.id}-${shipmentIndex + 1}`,

          shipmentNumber: shipmentIndex + 1,
          shipmentCount: groups.length,

          orderId: order.id,
          orderDate: order.createdAt,
          paidAt: order.paidAt,

          seller: {
            id: fulfillment.supplier?.id ?? null,
            name: fulfillment.supplier?.name ?? "فروشگاه برجک",
          },

          customer: {
            name: order.receiverName,
            phone: order.receiverPhone,
            province: order.provinceName,
            city: order.cityName,
            address: order.address,
            postalCode: order.postalCode,
          },

          payment: {
            status: "PAID",
            reference:
              order.transaction?.refId || order.refId || null,
          },

          shipping: {
            method: fulfillment.shippingMethod,
            methodLabel:
              SHIPPING_METHOD_LABELS[fulfillment.shippingMethod],
            cost: shippingCost,
            discount: shippingDiscount,
            finalCost: finalShippingCost,
            trackingCode: fulfillment.trackingCode,
          },

          items: productLines,

          totals: {
            originalSubtotal,
            productDiscountTotal,
            productSubtotal,
            storeDiscountShare,
            shippingCost,
            shippingDiscount,
            finalShippingCost,
            invoiceTotal,
          },

          // جزئیات تخفیف کل سفارش فقط برای ادمین.
          ...(isAdmin
            ? {
                admin: {
                  orderCouponCode: couponCode || null,
                  orderCouponType: couponType,
                  orderCouponDiscount: couponDiscount,
                  orderCouponShippingDiscount:
                    couponShippingDiscount,
                  orderProductSubtotal,
                  orderShippingCost,
                },
              }
            : {}),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
        },
      },
    );
  } catch (error) {
    console.error("FULFILLMENT_INVOICE_ERROR", {
      message: error?.message,
      code: error?.code,
    });

    return responseError(
      "خطا در دریافت اطلاعات فاکتور.",
      500,
    );
  }
}
