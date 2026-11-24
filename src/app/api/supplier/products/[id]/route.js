
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSupplier, logAction } from "@/lib/auth";
import { PRODUCT_LIST_SELECT } from "@/lib/supplier-products";
import {
  calculateProductPricing,
  PricingError,
} from "@/lib/pricing";

const notFound = () =>
  NextResponse.json({ error: "محصول پیدا نشد" }, { status: 404 });

const badRequest = (error, status = 400) =>
  NextResponse.json({ error }, { status });

const has = (body, key) =>
  Object.prototype.hasOwnProperty.call(body, key);

const PRODUCT_DETAIL_SELECT = {
  ...PRODUCT_LIST_SELECT,
  categoryId: true,
  description: true,
  images: true,
  specs: true,
};

// GET: جزئیات محصول متعلق به تأمین‌کننده جاری
export async function GET(_req, { params }) {
  const auth = await requireSupplier();
  if (auth.error) return auth.error;

  const { id: raw } = await params;
  const id = /^\d{1,9}$/.test(String(raw)) ? Number(raw) : null;

  if (!id) return notFound();

  try {
    const product = await prisma.product.findFirst({
      where: {
        id,
        supplierId: auth.user.id,
      },
      select: PRODUCT_DETAIL_SELECT,
    });

    return product
      ? NextResponse.json({ product })
      : notFound();
  } catch (error) {
    console.error("SUPPLIER_PRODUCT_ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت محصول" },
      { status: 500 },
    );
  }
}

// PATCH: ویرایش محصول متعلق به تأمین‌کننده جاری
export async function PATCH(req, { params }) {
  const auth = await requireSupplier();
  if (auth.error) return auth.error;

  try {
    const { id: raw } = await params;
    const id = /^\d{1,9}$/.test(String(raw)) ? Number(raw) : null;

    if (!id) return notFound();

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("اطلاعات ارسالی معتبر نیست");
    }

    // تأمین‌کننده اجازه تغییر فیلدهای مدیریتی و قیمت‌های محاسبه‌شده را ندارد.
    const forbiddenFields = [
      "supplierId",
      "isPublished",
      "reviewStatus",
      "reviewNote",
      "deletedAt",
      "reservedStock",
      "slug",
      "rating",
      "reviewCount",
      "price",
      "originalPrice",
      "commissionPercent",
      "republishAfterReview",
    ];

    if (forbiddenFields.some((field) => has(body, field))) {
      return badRequest(
        "تغییر فیلدهای مدیریتی، مالکیت یا قیمت‌های محاسبه‌شده مجاز نیست",
        403,
      );
    }

    const fullEditFields = [
      "title",
      "basePrice",
      "discount",
      "categoryId",
      "image",
      "gallery",
      "description",
      "specs",
    ];

    const isFullEdit = fullEditFields.some((field) =>
      has(body, field),
    );

    const hasStock = has(body, "stock");

    if (!isFullEdit && !hasStock) {
      return badRequest("هیچ اطلاعاتی برای ویرایش ارسال نشده است");
    }

    const updateData = {};

    if (hasStock) {
      const stock = Number(body.stock);

      if (!Number.isSafeInteger(stock) || stock < 0) {
        return badRequest("موجودی محصول معتبر نیست");
      }

      updateData.stock = stock;
    }

    if (isFullEdit) {
      const requiredFields = [
        "title",
        "basePrice",
        "categoryId",
        "image",
        "gallery",
        "description",
        "specs",
      ];

      if (requiredFields.some((field) => !has(body, field))) {
        return badRequest("اطلاعات محصول برای ویرایش کامل نیست");
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

      const finalBasePrice = Number(basePrice);
      const finalDiscount = Number(discount ?? 0);
      const finalCategoryId = Number(categoryId);

      if (
        typeof title !== "string" ||
        !title.trim() ||
        title.length > 200 ||
        typeof description !== "string" ||
        !description.trim() ||
        typeof image !== "string" ||
        !image.trim() ||
        !Number.isSafeInteger(finalBasePrice) ||
        finalBasePrice <= 0 ||
        !Number.isSafeInteger(finalDiscount) ||
        finalDiscount < 0 ||
        finalDiscount > 99 ||
        !Number.isSafeInteger(finalCategoryId) ||
        finalCategoryId <= 0
      ) {
        return badRequest("اطلاعات محصول را به‌درستی وارد کنید");
      }

      let pricing;

      try {
        pricing = calculateProductPricing({
          basePrice: finalBasePrice,
          discount: finalDiscount,
        });
      } catch (error) {
        if (error instanceof PricingError) {
          return badRequest(error.message);
        }

        throw error;
      }

      // تصویر اصلی جداگانه است؛ حداکثر ۴ تصویر گالری
      if (
        !Array.isArray(gallery) ||
        gallery.length > 4 ||
        gallery.some(
          (url) => typeof url !== "string" || !url.trim(),
        )
      ) {
        return badRequest("حداکثر ۴ تصویر گالری مجاز است");
      }

      if (!Array.isArray(specs)) {
        return badRequest("فهرست مشخصات فنی معتبر نیست");
      }

      const normalizedSpecs = specs
        .filter(
          (spec) =>
            spec &&
            typeof spec.key === "string" &&
            spec.key.trim() &&
            spec.value != null &&
            String(spec.value).trim(),
        )
        .map((spec) => ({
          key: spec.key.trim(),
          value: String(spec.value).trim(),
        }));

      Object.assign(updateData, {
        title: title.trim(),

        // تمام مقادیر مالی توسط موتور قیمت‌گذاری محاسبه می‌شوند.
        basePrice: pricing.basePrice,
        commissionPercent: pricing.commissionPercent,
        price: pricing.price,
        originalPrice: pricing.originalPrice,
        discount: pricing.discount,

        categoryId: finalCategoryId,
        image: image.trim(),
        description: description.trim(),

        images: {
          deleteMany: {},
          create: gallery.map((url) => ({
            url: url.trim(),
          })),
        },

        specs: {
          deleteMany: {},
          create: normalizedSpecs,
        },

        // ویرایش محتوایی باید دوباره بررسی شود.
        isPublished: false,
        reviewStatus: "PENDING",
        reviewNote: null,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // قفل محصول برای جلوگیری از تداخل تغییر موجودی با رزرو
      const locked = await tx.$queryRaw`
        SELECT "id"
        FROM "Product"
        WHERE "id" = ${id}
          AND "supplierId" = ${auth.user.id}
        FOR UPDATE
      `;

      if (!locked.length) {
        return { type: "NOT_FOUND" };
      }

      const oldProduct = await tx.product.findFirst({
        where: {
          id,
          supplierId: auth.user.id,
        },
        select: {
          id: true,
          title: true,
          basePrice: true,
          price: true,
          originalPrice: true,
          discount: true,
          stock: true,
          reservedStock: true,
          categoryId: true,
          isPublished: true,
          republishAfterReview: true,
          reviewStatus: true,
          reviewNote: true,
          deletedAt: true,
        },
      });

      if (!oldProduct) {
        return { type: "NOT_FOUND" };
      }

      if (oldProduct.deletedAt) {
        return { type: "ARCHIVED" };
      }

      // موجودی نباید از تعداد رزروشده کمتر شود.
      if (
        hasStock &&
        updateData.stock < oldProduct.reservedStock
      ) {
        return {
          type: "BELOW_RESERVED_STOCK",
          reservedStock: oldProduct.reservedStock,
        };
      }

      if (isFullEdit) {
        const category = await tx.category.findUnique({
          where: {
            id: updateData.categoryId,
          },
          select: { id: true },
        });

        if (!category) {
          return { type: "CATEGORY_NOT_FOUND" };
        }

        // اگر محصول قبلاً منتشر بوده، پس از تأیید مجدد منتشر شود.
        // اگر قبلاً برای بررسی رد شده، پرچم قبلی حفظ می‌شود.
        updateData.republishAfterReview =
          oldProduct.republishAfterReview ||
          oldProduct.isPublished;
      }

      const product = await tx.product.update({
        where: { id },
        data: updateData,
        select: PRODUCT_DETAIL_SELECT,
      });

      return {
        type: "UPDATED",
        oldProduct,
        product,
      };
    });

    if (result.type === "NOT_FOUND") return notFound();

    if (result.type === "ARCHIVED") {
      return badRequest("محصول آرشیوشده قابل ویرایش نیست", 409);
    }

    if (result.type === "CATEGORY_NOT_FOUND") {
      return badRequest("دسته‌بندی انتخاب‌شده پیدا نشد", 404);
    }

    if (result.type === "BELOW_RESERVED_STOCK") {
      return NextResponse.json(
        {
          error: `حداقل موجودی قابل ثبت ${result.reservedStock} عدد است؛ چون همین تعداد رزرو شده است.`,
          reservedStock: result.reservedStock,
        },
        { status: 409 },
      );
    }

    await logAction({
      userId: auth.user.id,
      action: "UPDATE_PRODUCT",
      entityType: "Product",
      entityId: String(id),
      description: isFullEdit
        ? `محصول «${result.product.title}» ویرایش و برای تأیید مجدد ارسال شد`
        : `موجودی محصول «${result.product.title}» تغییر کرد`,
      oldValue: result.oldProduct,
      newValue: {
        title: result.product.title,
        basePrice: result.product.basePrice,
        price: result.product.price,
        originalPrice: result.product.originalPrice,
        discount: result.product.discount,
        stock: result.product.stock,
        reservedStock: result.product.reservedStock,
        isPublished: result.product.isPublished,
        reviewStatus: result.product.reviewStatus,
        republishAfterReview: isFullEdit
          ? result.product.republishAfterReview
          : result.oldProduct.republishAfterReview,
      },
    });

    return NextResponse.json({
      success: true,
      product: result.product,
      requiresReview: isFullEdit,
    });
  } catch (error) {
    console.error("PATCH SUPPLIER PRODUCT ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error instanceof PricingError) {
      return badRequest(error.message);
    }

    if (error?.code === "P2025") {
      return notFound();
    }

    if (error?.code === "P2002") {
      return badRequest("آدرس محصول تکراری است", 409);
    }

    return NextResponse.json(
      { error: "خطا در ویرایش محصول" },
      { status: 500 },
    );
  }
}
