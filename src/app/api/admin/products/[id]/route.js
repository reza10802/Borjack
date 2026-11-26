
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  logAction,
} from "@/lib/auth";
import {
  setProductPublished,
  setProductReviewStatus,
  PublishRefusal,
  ReviewRefusal,
} from "@/lib/supplier-lifecycle";
import {
  calculateProductPricing,
  PricingError,
} from "@/lib/pricing";

const MAX_PRODUCT_STOCK = 1_000_000;

function errorResponse(message, status = 400, extra = {}) {
  return NextResponse.json(
    { error: message, ...extra },
    { status },
  );
}

function isValidProductId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// PATCH /api/admin/products/[id]
export async function PATCH(req, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id: rawId } = await params;
    const productId = Number(rawId);

    if (!isValidProductId(productId)) {
      return errorResponse("شناسه محصول معتبر نیست");
    }

    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("اطلاعات ارسالی معتبر نیست");
    }

    const has = (key) =>
      Object.prototype.hasOwnProperty.call(body, key);

    // reservedStock فقط توسط سیستم رزرو سفارش مدیریت می‌شود.
    if (has("reservedStock")) {
      return errorResponse(
        "موجودی رزروشده قابل ویرایش دستی نیست و توسط سیستم مدیریت می‌شود.",
      );
    }

    // ---------------------------------------------------------
    // 1. انتقال مالکیت محصول
    // این عملیات باید مستقل ارسال شود.
    // ---------------------------------------------------------

    if (has("supplierId")) {
      if (Object.keys(body).some((key) => key !== "supplierId")) {
        return errorResponse(
          "تغییر مالکیت باید به‌صورت مستقل ارسال شود",
        );
      }

      let nextSupplierId = null;

      if (body.supplierId !== null) {
        if (
          typeof body.supplierId !== "string" ||
          !body.supplierId.trim() ||
          body.supplierId.length > 128
        ) {
          return errorResponse(
            "شناسه تأمین‌کننده معتبر نیست",
          );
        }

        nextSupplierId = body.supplierId.trim();
      }

      const transfer = await prisma.$transaction(async (tx) => {
        let targetSupplier = null;

        if (nextSupplierId) {
          await tx.$queryRaw`
            SELECT "id"
            FROM "User"
            WHERE "id" = ${nextSupplierId}
            FOR UPDATE
          `;

          targetSupplier = await tx.user.findFirst({
            where: {
              id: nextSupplierId,
              role: "SUPPLIER",
            },
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          });

          if (!targetSupplier) {
            return { type: "INVALID_SUPPLIER" };
          }
        }

        await tx.$queryRaw`
          SELECT "id"
          FROM "Product"
          WHERE "id" = ${productId}
          FOR UPDATE
        `;

        const current = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            title: true,
            supplierId: true,
            isPublished: true,
            deletedAt: true,
          },
        });

        if (!current) {
          return { type: "NOT_FOUND" };
        }

        if (current.supplierId === nextSupplierId) {
          return { type: "UNCHANGED" };
        }

        const shouldUnpublish =
          targetSupplier !== null && !targetSupplier.isActive;

        const product = await tx.product.update({
          where: { id: productId },
          data: {
            supplierId: nextSupplierId,
            ...(shouldUnpublish
              ? { isPublished: false }
              : {}),
          },
          select: {
            id: true,
            title: true,
            supplierId: true,
            isPublished: true,
            deletedAt: true,
          },
        });

        return {
          type: "TRANSFERRED",
          current,
          product,
          targetSupplier,
        };
      });

      if (transfer.type === "NOT_FOUND") {
        return errorResponse("محصول پیدا نشد", 404);
      }

      if (transfer.type === "INVALID_SUPPLIER") {
        return errorResponse(
          "حساب تأمین‌کننده موردنظر معتبر نیست",
          404,
        );
      }

      if (transfer.type === "UNCHANGED") {
        return NextResponse.json({
          success: true,
          message: "مالکیت محصول تغییری نکرده است",
        });
      }

      await logAction({
        userId: check.user.id,
        action: "UPDATE_PRODUCT",
        entityType: "Product",
        entityId: String(productId),
        description: `مالکیت محصول «${transfer.product.title}» تغییر کرد`,
        oldValue: {
          supplierId: transfer.current.supplierId,
        },
        newValue: {
          supplierId: transfer.product.supplierId,
          supplierName: transfer.targetSupplier?.name ?? null,
          isPublished: transfer.product.isPublished,
        },
      });

      return NextResponse.json({
        success: true,
        product: transfer.product,
        message: "مالکیت محصول با موفقیت تغییر کرد",
      });
    }

    // ---------------------------------------------------------
    // 2. تأیید یا رد محصول
    // ---------------------------------------------------------

    if (has("reviewStatus")) {
      const allowedKeys = ["reviewStatus", "reviewNote"];

      if (
        Object.keys(body).some(
          (key) => !allowedKeys.includes(key),
        )
      ) {
        return errorResponse(
          "عملیات بررسی محصول باید مستقل از سایر تغییرات ارسال شود",
        );
      }

      try {
        const result = await prisma.$transaction((tx) =>
          setProductReviewStatus(
            tx,
            productId,
            body.reviewStatus,
            body.reviewNote ?? null,
          ),
        );

        if (result.changed) {
          const isApproved =
            result.reviewStatus === "APPROVED";

          await logAction({
            userId: check.user.id,
            action: "UPDATE_PRODUCT",
            entityType: "Product",
            entityId: String(productId),
            description: isApproved
              ? `محصول «${result.title}» تأیید شد`
              : `محصول «${result.title}» رد شد: ${result.reviewNote}`,
            oldValue: result.oldValue,
            newValue: result.newValue,
          });
        }

        const {
          changed,
          oldValue,
          newValue,
          ...product
        } = result;

        return NextResponse.json({
          success: true,
          changed,
          product,
          message:
            product.reviewStatus === "APPROVED"
              ? "محصول با موفقیت تأیید شد"
              : "محصول رد شد و دلیل آن ثبت شد",
        });
      } catch (error) {
        if (error instanceof ReviewRefusal) {
          return errorResponse(
            error.message,
            error.status,
          );
        }

        throw error;
      }
    }

    // ---------------------------------------------------------
    // 3. انتشار یا خارج‌کردن محصول از انتشار
    // ---------------------------------------------------------

    if (has("isPublished")) {
      const allowedKeys = ["isPublished", "reviewNote"];

      if (
        typeof body.isPublished !== "boolean" ||
        Object.keys(body).some(
          (key) => !allowedKeys.includes(key),
        )
      ) {
        return errorResponse(
          "وضعیت انتشار باید به‌صورت مستقل و با مقدار معتبر ارسال شود",
        );
      }

      if (
        body.isPublished &&
        has("reviewNote") &&
        body.reviewNote != null
      ) {
        return errorResponse(
          "هنگام انتشار محصول نیازی به ارسال پیام نیست",
        );
      }

      try {
        const result = await prisma.$transaction((tx) =>
          setProductPublished(
            tx,
            productId,
            body.isPublished,
            body.reviewNote ?? null,
          ),
        );

        if (result.changed) {
          await logAction({
            userId: check.user.id,
            action: "UPDATE_PRODUCT",
            entityType: "Product",
            entityId: String(productId),
            description: body.isPublished
              ? "محصول منتشر شد"
              : `انتشار محصول لغو شد: ${result.reviewNote}`,
            oldValue: result.oldValue,
            newValue: result.newValue,
          });
        }

        return NextResponse.json({
          success: true,
          ...result,
          message: body.isPublished
            ? "محصول با موفقیت منتشر شد"
            : "محصول از انتشار خارج شد و پیام ثبت شد",
        });
      } catch (error) {
        if (error instanceof PublishRefusal) {
          return errorResponse(
            error.message,
            error.status,
          );
        }

        throw error;
      }
    }

    // ---------------------------------------------------------
    // 4. ویرایش اطلاعات محصول، قیمت یا موجودی
    // ---------------------------------------------------------

    // قیمت نهایی، قیمت اصلی مشتری و کمیسیون باید فقط
    // توسط موتور قیمت‌گذاری محاسبه شوند.
    if (
      has("price") ||
      has("originalPrice") ||
      has("commissionPercent")
    ) {
      return errorResponse(
        "قیمت فروش و کمیسیون محاسبه‌شده هستند. فقط قیمت پایه و درصد تخفیف را ارسال کنید.",
      );
    }

    const fullEditKeys = [
      "title",
      "categoryId",
      "image",
      "gallery",
      "description",
      "specs",
    ];

    const allowedEditKeys = [
      ...fullEditKeys,
      "basePrice",
      "discount",
      "stock",
    ];

    const unknownKeys = Object.keys(body).filter(
      (key) => !allowedEditKeys.includes(key),
    );

    if (unknownKeys.length > 0) {
      return errorResponse(
        "فیلدهای ارسالی برای ویرایش محصول معتبر نیستند.",
      );
    }

    const isFullEdit = fullEditKeys.some(has);
    const hasStock = has("stock");

    const hasPricingChange =
      has("basePrice") || has("discount");

    if (!isFullEdit && !hasStock && !hasPricingChange) {
      return errorResponse(
        "هیچ اطلاعاتی برای ویرایش ارسال نشده است",
      );
    }

    const updateData = {};

    // ---------------------------------------------------------
    // 4-الف. اعتبارسنجی موجودی
    // ---------------------------------------------------------

    if (hasStock) {
      // API فقط عدد واقعی می‌پذیرد؛ رشته عددی پذیرفته نمی‌شود.
      const stock = body.stock;

      if (
        typeof stock !== "number" ||
        !Number.isSafeInteger(stock) ||
        stock < 0 ||
        stock > MAX_PRODUCT_STOCK
      ) {
        return errorResponse(
          `موجودی باید عددی صحیح بین صفر و ${MAX_PRODUCT_STOCK.toLocaleString("fa-IR")} باشد.`,
        );
      }

      updateData.stock = stock;
    }

    // ---------------------------------------------------------
    // 4-ب. اعتبارسنجی قیمت
    // ---------------------------------------------------------

    let finalBasePrice;
    let finalDiscount;

    if (has("basePrice")) {
      finalBasePrice = body.basePrice;

      if (
        typeof finalBasePrice !== "number" ||
        !Number.isSafeInteger(finalBasePrice) ||
        finalBasePrice <= 0
      ) {
        return errorResponse("قیمت پایه معتبر نیست");
      }
    }

    if (has("discount")) {
      finalDiscount = body.discount;

      if (
        typeof finalDiscount !== "number" ||
        !Number.isSafeInteger(finalDiscount) ||
        finalDiscount < 0 ||
        finalDiscount > 99
      ) {
        return errorResponse(
          "درصد تخفیف باید عددی صحیح بین صفر تا ۹۹ باشد",
        );
      }
    }

    // ---------------------------------------------------------
    // 4-پ. اعتبارسنجی اطلاعات اصلی محصول
    // ---------------------------------------------------------

    if (isFullEdit) {
      const requiredFields = [
        "title",
        "categoryId",
        "image",
        "gallery",
        "description",
        "specs",
      ];

      if (requiredFields.some((field) => !has(field))) {
        return errorResponse(
          "اطلاعات محصول برای ویرایش کامل نیست",
        );
      }

      const {
        title,
        categoryId,
        image,
        gallery,
        description,
        specs,
      } = body;

      const finalCategoryId = Number(categoryId);

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200 ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof image !== "string" ||
        !image.trim() ||
        !Number.isSafeInteger(finalCategoryId) ||
        finalCategoryId <= 0
      ) {
        return errorResponse(
          "اطلاعات محصول را به‌درستی وارد کنید",
        );
      }

      if (
        !Array.isArray(gallery) ||
        gallery.length > 4 ||
        gallery.some(
          (url) =>
            typeof url !== "string" || !url.trim(),
        )
      ) {
        return errorResponse(
          "حداکثر ۴ تصویر اضافی برای گالری مجاز است",
        );
      }

      if (!Array.isArray(specs)) {
        return errorResponse(
          "فهرست مشخصات فنی معتبر نیست",
        );
      }

      const normalizedSpecs = specs
        .filter(
          (spec) =>
            spec &&
            typeof spec.key === "string" &&
            typeof spec.value === "string" &&
            spec.key.trim() &&
            spec.value.trim(),
        )
        .map((spec) => ({
          key: spec.key.trim(),
          value: spec.value.trim(),
        }));

      updateData.title = title.trim();
      updateData.image = image.trim();
      updateData.description = description.trim();

      updateData.category = {
        connect: {
          id: finalCategoryId,
        },
      };

      updateData.images = {
        deleteMany: {},
        create: gallery.map((url) => ({
          url: url.trim(),
        })),
      };

      updateData.specs = {
        deleteMany: {},
        create: normalizedSpecs,
      };
    }

    // ---------------------------------------------------------
    // 4-ت. ذخیره تغییرات در تراکنش
    // ---------------------------------------------------------

    const result = await prisma.$transaction(async (tx) => {
      // قفل ردیف محصول برای جلوگیری از تداخل تغییر موجودی
      // با عملیات هم‌زمانی که همین ردیف را قفل می‌کنند.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `;

      const oldProduct = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          basePrice: true,
          commissionPercent: true,
          price: true,
          originalPrice: true,
          discount: true,
          stock: true,
          reservedStock: true,
          categoryId: true,
          deletedAt: true,
        },
      });

      if (!oldProduct) {
        return { type: "NOT_FOUND" };
      }

      if (oldProduct.deletedAt) {
        return { type: "ARCHIVED" };
      }

      // مقدار رزرو باید معتبر باشد.
      const currentReservedStock =
        oldProduct.reservedStock ?? 0;

      if (
        !Number.isSafeInteger(currentReservedStock) ||
        currentReservedStock < 0
      ) {
        return { type: "INVALID_RESERVED_STOCK" };
      }

      // موجودی کل نباید از تعداد رزروشده کمتر شود.
      if (
        hasStock &&
        updateData.stock < currentReservedStock
      ) {
        return {
          type: "BELOW_RESERVED_STOCK",
          reservedStock: currentReservedStock,
        };
      }

      // -------------------------------------------------------
      // محاسبه قیمت
      // -------------------------------------------------------

      if (hasPricingChange) {
        const effectiveBasePrice = has("basePrice")
          ? finalBasePrice
          : oldProduct.basePrice;

        const effectiveDiscount = has("discount")
          ? finalDiscount
          : oldProduct.discount ?? 0;

        // محصولات قدیمی ممکن است هنوز قیمت پایه نداشته باشند.
        if (effectiveBasePrice == null) {
          return { type: "BASE_PRICE_REQUIRED" };
        }

        const pricing = calculateProductPricing({
          basePrice: Number(effectiveBasePrice),
          discount: Number(effectiveDiscount),
        });

        Object.assign(updateData, {
          basePrice: pricing.basePrice,
          commissionPercent: pricing.commissionPercent,
          originalPrice: pricing.originalPrice,
          price: pricing.price,
          discount: pricing.discount,
        });
      }

      // -------------------------------------------------------
      // ذخیره محصول
      // -------------------------------------------------------

      const product = await tx.product.update({
        where: { id: productId },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              title: true,
            },
          },
          images: true,
          specs: true,
        },
      });

      return {
        type: "UPDATED",
        oldProduct,
        product,
      };
    });

    // ---------------------------------------------------------
    // 4-ث. بررسی نتیجه تراکنش
    // ---------------------------------------------------------

    if (result.type === "NOT_FOUND") {
      return errorResponse("محصول پیدا نشد", 404);
    }

    if (result.type === "ARCHIVED") {
      return errorResponse(
        "محصول آرشیوشده قابل ویرایش نیست",
        409,
      );
    }

    if (result.type === "INVALID_RESERVED_STOCK") {
      return errorResponse(
        "مقدار موجودی رزروشده محصول در پایگاه داده معتبر نیست.",
        409,
      );
    }

    if (result.type === "BASE_PRICE_REQUIRED") {
      return errorResponse(
        "این محصول هنوز قیمت پایه ندارد. برای تغییر قیمت آن ابتدا قیمت پایه تأمین‌کننده را وارد کنید.",
        409,
      );
    }

    if (result.type === "BELOW_RESERVED_STOCK") {
      return errorResponse(
        `حداقل موجودی قابل ثبت ${result.reservedStock.toLocaleString("fa-IR")} عدد است؛ چون همین تعداد در حال حاضر رزرو شده است.`,
        409,
        {
          reservedStock: result.reservedStock,
        },
      );
    }

    // ---------------------------------------------------------
    // 4-ج. ثبت لاگ تغییرات
    // ---------------------------------------------------------

    await logAction({
      userId: check.user.id,
      action: "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: String(productId),
      description: `محصول «${result.product.title}» ویرایش شد`,
      oldValue: result.oldProduct,
      newValue: {
        title: result.product.title,
        basePrice: result.product.basePrice,
        commissionPercent: result.product.commissionPercent,
        price: result.product.price,
        originalPrice: result.product.originalPrice,
        discount: result.product.discount,
        stock: result.product.stock,
        reservedStock: result.product.reservedStock,
        categoryId: result.product.categoryId,
      },
    });

    return NextResponse.json({
      success: true,
      product: result.product,
    });
  } catch (error) {
    console.error("PATCH ADMIN PRODUCT ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error instanceof PricingError) {
      return errorResponse(error.message, 400);
    }

    if (error?.code === "P2025") {
      return errorResponse(
        "محصول یا دسته‌بندی موردنظر پیدا نشد",
        400,
      );
    }

    return errorResponse(
      "خطا در ویرایش محصول",
      500,
    );
  }
}

// DELETE /api/admin/products/[id]
// آرشیو محصول بدون حذف سوابق سفارش
export async function DELETE(_req, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id: rawId } = await params;
    const productId = Number(rawId);

    if (!isValidProductId(productId)) {
      return errorResponse("شناسه محصول معتبر نیست");
    }

    const result = await prisma.$transaction(async (tx) => {
      // قفل ردیف مانع تداخل عملیات آرشیو با رزرو هم‌زمان می‌شود.
      await tx.$queryRaw`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `;

      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          basePrice: true,
          stock: true,
          reservedStock: true,
          isPublished: true,
          deletedAt: true,
          _count: {
            select: {
              orderItems: true,
            },
          },
        },
      });

      if (!product) {
        return { type: "NOT_FOUND" };
      }

      if (product.deletedAt) {
        return { type: "ALREADY_ARCHIVED" };
      }

      // محصولی که رزرو فعال دارد نباید آرشیو شود.
      if (product.reservedStock > 0) {
        return {
          type: "HAS_RESERVATIONS",
          reservedStock: product.reservedStock,
        };
      }

      // حذف محصول از سبد خرید تمام کاربران
      await tx.cartItem.deleteMany({
        where: { productId },
      });

      // آرشیو محصول بدون حذف رکورد و روابط آن
      const archivedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          deletedAt: new Date(),
          isPublished: false,
        },
      });

      return {
        type: "ARCHIVED",
        product,
        archivedProduct,
      };
    });

    if (result.type === "NOT_FOUND") {
      return errorResponse("محصول پیدا نشد", 404);
    }

    if (result.type === "ALREADY_ARCHIVED") {
      return NextResponse.json({
        success: true,
        message: "این محصول قبلاً آرشیو شده است",
      });
    }

    if (result.type === "HAS_RESERVATIONS") {
      return errorResponse(
        `این محصول ${result.reservedStock.toLocaleString("fa-IR")} عدد رزرو فعال دارد. تا تعیین تکلیف رزروها امکان آرشیو آن وجود ندارد.`,
        409,
        {
          reservedStock: result.reservedStock,
        },
      );
    }

    await logAction({
      userId: check.user.id,
      action: "DELETE_PRODUCT",
      entityType: "Product",
      entityId: String(productId),
      description: `محصول «${result.product.title}» آرشیو شد`,
      oldValue: {
        id: result.product.id,
        title: result.product.title,
        slug: result.product.slug,
        price: result.product.price,
        basePrice: result.product.basePrice,
        stock: result.product.stock,
        reservedStock: result.product.reservedStock,
        isPublished: result.product.isPublished,
        orderItemsCount: result.product._count.orderItems,
      },
      newValue: {
        deletedAt: result.archivedProduct.deletedAt,
        isPublished: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "محصول با موفقیت آرشیو شد",
    });
  } catch (error) {
    console.error("ARCHIVE ADMIN PRODUCT ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return errorResponse(
      "خطا در آرشیو محصول",
      500,
    );
  }
}
