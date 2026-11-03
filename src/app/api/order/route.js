
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser, logAction } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validations/checkout";
import { validateProvinceCity } from "@/lib/iranLocations";

const SHIPPING_METHODS = new Set(["POST", "TIPAX", "SNAPPBOX"]);
const MAX_QUANTITY_PER_ITEM = 20;

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

function getCartSnapshot(items) {
  return items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.product.price),
    }))
    .sort((a, b) => a.productId - b.productId);
}

function isSameCheckout(order, data) {
  const oldItems = order.items
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
    }))
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
    order.shippingMethod === data.shippingMethod;

  return (
    sameItems &&
    sameReceiver &&
    Number(order.total) === Number(data.total)
  );
}

function normalizeOrderProducts(orders) {
  return orders.map((order) => ({
    ...order,
    items: order.items.map((item) => {
      if (!item.product) return item;

      const {
        reservedStock,
        ...publicProduct
      } = item.product;

      return {
        ...item,
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
    } = parsed.data;

    const shippingMethod = SHIPPING_METHODS.has(body?.shippingMethod)
      ? body.shippingMethod
      : "POST";

    const location = validateProvinceCity(provinceId, cityId);

    if (!location.valid) {
      return NextResponse.json(
        { error: location.message },
        { status: 400 },
      );
    }

    const { province, city } = location;

    const cartItems = await prisma.cartItem.findMany({
      where: {
        userId: user.id,
      },
      include: {
        product: true,
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
        item.product.deletedAt !== null,
    );

    if (archivedItems.length > 0) {
      const archivedProductIds = archivedItems.map(
        (item) => item.productId,
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

    // اعتبارسنجی اولیه تعداد و قیمت
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

      if (
        !Number.isSafeInteger(Number(item.product.price)) ||
        Number(item.product.price) <= 0
      ) {
        return NextResponse.json(
          { error: "قیمت یکی از کالاها معتبر نیست" },
          { status: 409 },
        );
      }
    }

    // محاسبه مبلغ بر اساس اطلاعات دیتابیس
    const total = cartItems.reduce(
      (sum, item) =>
        sum +
        Number(item.product.price) * item.quantity,
      0,
    );

    if (!Number.isSafeInteger(total) || total <= 0) {
      return NextResponse.json(
        { error: "مبلغ سفارش معتبر نیست" },
        { status: 400 },
      );
    }

    const checkoutData = {
      receiverName,
      receiverPhone,
      provinceId: province.id,
      cityId: city.id,
      address,
      postalCode,
      shippingMethod,
      cartItems,
      total,
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
      },
    });

    if (pendingOrder) {
      const sameCheckout = isSameCheckout(
        pendingOrder,
        checkoutData,
      );

      // سفارش دارای رزرو فعال نباید تغییر کند.
      if (
        pendingOrder.stockReservationStatus === "RESERVED"
      ) {
        if (
          pendingOrder.transaction?.status === "PENDING" &&
          pendingOrder.authority &&
          sameCheckout
        ) {
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

      // سفارش دارای مشکل موجودی یا وضعیت مصرف‌شده قابل استفاده مجدد نیست.
      if (
        ["ISSUE", "CONSUMED"].includes(
          pendingOrder.stockReservationStatus,
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

      // تراکنش فعال قدیمی بدون رزرو، باید تعیین تکلیف شود.
      if (pendingOrder.transaction?.status === "PENDING") {
        return NextResponse.json(
          {
            error:
              "یک پرداخت فعال برای سفارش قبلی وجود دارد که وضعیت رزرو آن مشخص نیست. لطفاً با پشتیبانی تماس بگیرید.",
          },
          { status: 409 },
        );
      }

      if (pendingOrder.transaction?.status === "SUCCESS") {
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

      // سفارش یکسان و بدون پرداخت فعال قابل استفاده مجدد است.
      if (sameCheckout) {
        return NextResponse.json({
          success: true,
          orderId: pendingOrder.id,
          reused: true,
        });
      }
    }

    // بررسی اولیه موجودی آزاد
    for (const item of cartItems) {
      const availableStock = getAvailableStock(item.product);

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

    if (pendingOrder) {
      // سفارش قبلی پرداخت‌نشده و بدون رزرو فعال است؛
      // اطلاعات آن را جایگزین می‌کنیم.
      const updateResult = await prisma.$transaction(async (tx) => {
        // ترتیب قفل‌گذاری با مسیرهای پرداخت یکسان است.
        await lockUser(tx, user.id);

        await tx.$queryRaw`
          SELECT "id"
          FROM "Order"
          WHERE "id" = ${pendingOrder.id}
            AND "userId" = ${user.id}
          FOR UPDATE
        `;

        const currentOrder = await tx.order.findUnique({
          where: {
            id: pendingOrder.id,
          },
          include: {
            items: true,
            transaction: true,
          },
        });

        if (
          !currentOrder ||
          currentOrder.paymentStatus !== "PENDING" ||
          currentOrder.status !== "PENDING" ||
          currentOrder.stockReservationStatus === "RESERVED" ||
          ["CONSUMED", "ISSUE"].includes(
            currentOrder.stockReservationStatus,
          ) ||
          currentOrder.transaction?.status === "PENDING" ||
          currentOrder.transaction?.status === "SUCCESS" ||
          (currentOrder.authority && !currentOrder.transaction)
        ) {
          return { type: "STATE_CHANGED" };
        }

        // قفل محصولات به ترتیب ثابت
        const productIds = getSortedProductIds(cartItems);
        await lockProducts(tx, productIds);

        // بررسی مجدد محصول، موجودی و قیمت پس از گرفتن قفل
        const freshProducts = await tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
            deletedAt: null,
            isPublished: true,
          },
          select: {
            id: true,
            title: true,
            stock: true,
            reservedStock: true,
            price: true,
          },
        });

        const freshProductMap = new Map(
          freshProducts.map((product) => [
            product.id,
            product,
          ]),
        );

        let freshTotal = 0;

        for (const item of cartItems) {
          const product = freshProductMap.get(item.productId);

          if (
            !product ||
            item.quantity > getAvailableStock(product)
          ) {
            return {
              type: "STOCK_CHANGED",
              productId: item.productId,
            };
          }

          if (
            !Number.isSafeInteger(Number(product.price)) ||
            Number(product.price) <= 0
          ) {
            return {
              type: "PRICE_CHANGED",
              productId: item.productId,
            };
          }

          if (
            Number(product.price) !==
            Number(item.product.price)
          ) {
            return {
              type: "PRICE_CHANGED",
              productId: item.productId,
            };
          }

          freshTotal += Number(product.price) * item.quantity;
        }

        if (
          !Number.isSafeInteger(freshTotal) ||
          freshTotal !== total
        ) {
          return { type: "TOTAL_CHANGED" };
        }

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
            shippingMethod,
            shippingCost: 0,
            total: freshTotal,
            status: "PENDING",
            paymentStatus: "PENDING",
            authority: null,
            refId: null,
            paidAt: null,
            paymentExpiresAt: null,
            stockIssueAt: null,
          },
        });

        await tx.orderItem.createMany({
          data: cartItems.map((item) => ({
            orderId: pendingOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: freshProductMap.get(item.productId).price,
          })),
        });

        return {
          type: "UPDATED",
          order,
        };
      });

      if (updateResult.type === "STATE_CHANGED") {
        return NextResponse.json(
          {
            error:
              "وضعیت سفارش هم‌زمان تغییر کرده است. صفحه را تازه‌سازی و دوباره تلاش کنید.",
          },
          { status: 409 },
        );
      }

      if (
        updateResult.type === "STOCK_CHANGED" ||
        updateResult.type === "PRICE_CHANGED" ||
        updateResult.type === "TOTAL_CHANGED"
      ) {
        return NextResponse.json(
          {
            error:
              "موجودی یا قیمت یکی از کالاها تغییر کرده است. لطفاً سبد خرید را بررسی و دوباره تلاش کنید.",
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
    const createResult = await prisma.$transaction(async (tx) => {
      // جلوگیری از ایجاد دو سفارش هم‌زمان برای یک کاربر
      await lockUser(tx, user.id);

      const concurrentPendingOrder = await tx.order.findFirst({
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

      const productIds = getSortedProductIds(cartItems);
      await lockProducts(tx, productIds);

      const freshProducts = await tx.product.findMany({
        where: {
          id: {
            in: productIds,
          },
          deletedAt: null,
          isPublished: true,
        },
        select: {
          id: true,
          title: true,
          stock: true,
          reservedStock: true,
          price: true,
        },
      });

      const productMap = new Map(
        freshProducts.map((product) => [
          product.id,
          product,
        ]),
      );

      let freshTotal = 0;

      for (const item of cartItems) {
        const product = productMap.get(item.productId);

        if (
          !product ||
          item.quantity > getAvailableStock(product)
        ) {
          return {
            type: "STOCK_CHANGED",
            productId: item.productId,
          };
        }

        if (
          !Number.isSafeInteger(Number(product.price)) ||
          Number(product.price) <= 0 ||
          Number(product.price) !== Number(item.product.price)
        ) {
          return {
            type: "PRICE_CHANGED",
            productId: item.productId,
          };
        }

        freshTotal += Number(product.price) * item.quantity;
      }

      if (
        !Number.isSafeInteger(freshTotal) ||
        freshTotal !== total
      ) {
        return { type: "TOTAL_CHANGED" };
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
          shippingMethod,
          shippingCost: 0,
          total: freshTotal,
          status: "PENDING",
          paymentStatus: "PENDING",
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: productMap.get(item.productId).price,
            })),
          },
        },
      });

      return {
        type: "CREATED",
        order,
      };
    });

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

    if (
      createResult.type === "STOCK_CHANGED" ||
      createResult.type === "PRICE_CHANGED" ||
      createResult.type === "TOTAL_CHANGED"
    ) {
      return NextResponse.json(
        {
          error:
            "موجودی یا قیمت یکی از کالاها تغییر کرده است. لطفاً سبد خرید را بررسی و دوباره تلاش کنید.",
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

    return NextResponse.json(
      { error: "خطا در ثبت سفارش" },
      { status: 500 },
    );
  }
}
