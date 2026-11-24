
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

// PATCH /api/admin/products/[id]
// ویرایش محصول، تغییر موجودی، انتقال مالکیت، بررسی و انتشار
export async function PATCH(req, { params }) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  try {
    const { id: rawId } = await params;
    const productId = Number(rawId);

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول معتبر نیست" },
        { status: 400 },
      );
    }

    const body = await req.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "اطلاعات ارسالی معتبر نیست" },
        { status: 400 },
      );
    }

    const has = (key) =>
      Object.prototype.hasOwnProperty.call(body, key);

    // ---------------------------------------------------------
    // 1. تغییر مالکیت محصول
    // این عملیات باید مستقل ارسال شود.
    // ---------------------------------------------------------
    if (has("supplierId")) {
      if (Object.keys(body).some((key) => key !== "supplierId")) {
        return NextResponse.json(
          { error: "تغییر مالکیت باید به‌صورت مستقل ارسال شود" },
          { status: 400 },
        );
      }

      let nextSupplierId = null;

      if (body.supplierId !== null) {
        if (
          typeof body.supplierId !== "string" ||
          !body.supplierId.trim() ||
          body.supplierId.length > 128
        ) {
          return NextResponse.json(
            { error: "شناسه تأمین‌کننده معتبر نیست" },
            { status: 400 },
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
            ...(shouldUnpublish ? { isPublished: false } : {}),
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
        return NextResponse.json(
          { error: "محصول پیدا نشد" },
          { status: 404 },
        );
      }

      if (transfer.type === "INVALID_SUPPLIER") {
        return NextResponse.json(
          { error: "حساب تأمین‌کننده موردنظر معتبر نیست" },
          { status: 404 },
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
        return NextResponse.json(
          {
            error:
              "عملیات بررسی محصول باید مستقل از سایر تغییرات ارسال شود",
          },
          { status: 400 },
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
          const isApproved = result.reviewStatus === "APPROVED";

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
          return NextResponse.json(
            { error: error.message },
            { status: error.status },
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
        return NextResponse.json(
          {
            error:
              "وضعیت انتشار باید به‌صورت مستقل و با مقدار معتبر ارسال شود",
          },
          { status: 400 },
        );
      }

      if (
        body.isPublished &&
        has("reviewNote") &&
        body.reviewNote != null
      ) {
        return NextResponse.json(
          {
            error: "هنگام انتشار محصول نیازی به ارسال پیام نیست",
          },
          { status: 400 },
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
          return NextResponse.json(
            { error: error.message },
            { status: error.status },
          );
        }

        throw error;
      }
    }

    // ---------------------------------------------------------
    // 4. ویرایش اطلاعات محصول یا تغییر موجودی
    // ---------------------------------------------------------

    // قیمت نهایی، قیمت اصلی مشتری و کمیسیون باید فقط
    // توسط موتور قیمت‌گذاری محاسبه شوند.
    if (
      has("price") ||
      has("originalPrice") ||
      has("commissionPercent")
    ) {
      return NextResponse.json(
        {
          error:
            "قیمت فروش و کمیسیون محاسبه‌شده هستند. فقط قیمت پایه و درصد تخفیف را ارسال کنید.",
        },
        { status: 400 },
      );
    }

    const fullEditKeys = [
      "title",
      "basePrice",
      "discount",
      "categoryId",
      "image",
      "gallery",
      "description",
      "specs",
    ];

    const isFullEdit = fullEditKeys.some(has);
    const hasStock = has("stock");

    const hasPricingChange =
      has("basePrice") || has("discount");

    if (!isFullEdit && !hasStock) {
      return NextResponse.json(
        { error: "هیچ اطلاعاتی برای ویرایش ارسال نشده است" },
        { status: 400 },
      );
    }

    const updateData = {};

    // اعتبارسنجی تغییر موجودی
    if (hasStock) {
      const stock = Number(body.stock);

      if (!Number.isSafeInteger(stock) || stock < 0) {
        return NextResponse.json(
          { error: "موجودی محصول معتبر نیست" },
          { status: 400 },
        );
      }

      updateData.stock = stock;
    }

    let finalBasePrice;
    let finalDiscount;
    let finalCategoryId;

    // اعتبارسنجی و آماده‌سازی ویرایش کامل محصول
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
        return NextResponse.json(
          { error: "اطلاعات محصول برای ویرایش کامل نیست" },
          { status: 400 },
        );
      }

      const {
        title,
        basePrice,
        discount,
        categoryId,
        image,
        gallery,
        description,
        specs,
      } = body;

      finalCategoryId = Number(categoryId);

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 200 ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof image !== "string" ||
        !image.trim() ||
        !Number.isSafeInteger(finalCategoryId) ||
        finalCategoryId <= 0
      ) {
        return NextResponse.json(
          { error: "اطلاعات محصول را به‌درستی وارد کنید" },
          { status: 400 },
        );
      }

      if (has("basePrice")) {
        finalBasePrice = Number(basePrice);

        if (
          !Number.isSafeInteger(finalBasePrice) ||
          finalBasePrice <= 0
        ) {
          return NextResponse.json(
            { error: "قیمت پایه معتبر نیست" },
            { status: 400 },
          );
        }
      }

      if (has("discount")) {
        finalDiscount = Number(discount);

        if (
          !Number.isSafeInteger(finalDiscount) ||
          finalDiscount < 0 ||
          finalDiscount > 99
        ) {
          return NextResponse.json(
            { error: "درصد تخفیف باید بین صفر تا ۹۹ باشد" },
            { status: 400 },
          );
        }
      }

      if (
        !Array.isArray(gallery) ||
        gallery.length > 4 ||
        gallery.some(
          (url) => typeof url !== "string" || !url.trim(),
        )
      ) {
        return NextResponse.json(
          { error: "حداکثر ۴ تصویر گالری مجاز است" },
          { status: 400 },
        );
      }

      if (!Array.isArray(specs)) {
        return NextResponse.json(
          { error: "فهرست مشخصات فنی معتبر نیست" },
          { status: 400 },
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

    const result = await prisma.$transaction(async (tx) => {
      // جلوگیری از تداخل تغییر موجودی با رزرو هم‌زمان
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

      // موجودی واقعی نباید کمتر از مجموع رزروهای فعال باشد.
      if (
        hasStock &&
        updateData.stock < oldProduct.reservedStock
      ) {
        return {
          type: "BELOW_RESERVED_STOCK",
          reservedStock: oldProduct.reservedStock,
        };
      }

      // قیمت‌گذاری فقط در صورت تغییر صریح قیمت پایه یا تخفیف
      if (hasPricingChange) {
        const effectiveBasePrice =
          has("basePrice")
            ? finalBasePrice
            : oldProduct.basePrice;

        const effectiveDiscount =
          has("discount")
            ? finalDiscount
            : oldProduct.discount;

        // محصول قدیمی ممکن است هنوز قیمت پایه نداشته باشد.
        // قیمت‌های قدیمی در ویرایش‌های غیرمالی دست‌نخورده می‌مانند.
        if (effectiveBasePrice == null) {
          return { type: "BASE_PRICE_REQUIRED" };
        }

        const pricing = calculateProductPricing({
          basePrice: effectiveBasePrice,
          discount: effectiveDiscount,
        });

        Object.assign(updateData, {
          basePrice: pricing.basePrice,
          commissionPercent: pricing.commissionPercent,
          originalPrice: pricing.originalPrice,
          price: pricing.price,
          discount: pricing.discount,
        });
      }

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

    if (result.type === "NOT_FOUND") {
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "ARCHIVED") {
      return NextResponse.json(
        { error: "محصول آرشیوشده قابل ویرایش نیست" },
        { status: 409 },
      );
    }

    if (result.type === "BASE_PRICE_REQUIRED") {
      return NextResponse.json(
        {
          error:
            "این محصول هنوز قیمت پایه ندارد. برای انتقال آن به سیستم قیمت‌گذاری جدید، قیمت پایه تأمین‌کننده را وارد کنید.",
        },
        { status: 409 },
      );
    }

    if (result.type === "BELOW_RESERVED_STOCK") {
      return NextResponse.json(
        {
          error: `حداقل موجودی قابل ثبت ${result.reservedStock} عدد است؛ چون همین تعداد در حال حاضر رزرو شده است.`,
          reservedStock: result.reservedStock,
        },
        { status: 409 },
      );
    }

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
      return NextResponse.json(
        { error: error.message },
        { status: 400 },
      );
    }

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "محصول یا دسته‌بندی موردنظر پیدا نشد" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "خطا در ویرایش محصول" },
      { status: 500 },
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

    if (!Number.isSafeInteger(productId) || productId <= 0) {
      return NextResponse.json(
        { error: "شناسه محصول معتبر نیست" },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // قفل ردیف مانع رزرو هم‌زمان در حین آرشیو می‌شود.
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
      return NextResponse.json(
        { error: "محصول پیدا نشد" },
        { status: 404 },
      );
    }

    if (result.type === "ALREADY_ARCHIVED") {
      return NextResponse.json({
        success: true,
        message: "این محصول قبلاً آرشیو شده است",
      });
    }

    if (result.type === "HAS_RESERVATIONS") {
      return NextResponse.json(
        {
          error: `این محصول ${result.reservedStock} عدد رزرو فعال دارد. تا تعیین تکلیف رزروها امکان آرشیو آن وجود ندارد.`,
          reservedStock: result.reservedStock,
        },
        { status: 409 },
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

    return NextResponse.json(
      { error: "خطا در آرشیو محصول" },
      { status: 500 },
    );
  }
}
