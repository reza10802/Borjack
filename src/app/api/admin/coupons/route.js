
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { normalizeCouponCode } from "@/lib/coupons";

const MAX_DB_INT = 2_147_483_647;
const MAX_DESCRIPTION_LENGTH = 500;

const COUPON_TYPES = [
  "PERCENTAGE",
  "FIXED",
  "FREE_SHIPPING",
];

const ALLOWED_FIELDS = new Set([
  "id",
  "code",
  "type",
  "value",
  "minOrderAmount",
  "maxDiscountAmount",
  "description",
  "startsAt",
  "expiresAt",
  "isActive",
]);

function jsonError(error, status = 400) {
  return NextResponse.json(
    { error },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function validateFields(body) {
  const unknownFields = Object.keys(body).filter(
    (field) => !ALLOWED_FIELDS.has(field),
  );

  if (unknownFields.length) {
    return "فیلدهای ارسالی معتبر نیستند.";
  }

  return null;
}

function parseMoney(value, field, { nullable = false, allowZero = false } = {}) {
  if (
    nullable &&
    (value === null || value === "")
  ) {
    return null;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) ||
    value > MAX_DB_INT
  ) {
    throw new Error(`مقدار ${field} معتبر نیست.`);
  }

  return value;
}

function parseDescription(value) {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("توضیحات کوپن معتبر نیست.");
  }

  const description = value.trim();

  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error("توضیحات کوپن بیش از حد طولانی است.");
  }

  return description || null;
}

function parseOptionalDate(value, field) {
  if (value === null || value === "") {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`تاریخ ${field} معتبر نیست.`);
    }

    return value;
  }

  if (typeof value !== "string") {
    throw new Error(`تاریخ ${field} معتبر نیست.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`تاریخ ${field} معتبر نیست.`);
  }

  return date;
}

function validateCouponData(data) {
  if (
    typeof data.code !== "string" ||
    !/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(data.code)
  ) {
    return "کد تخفیف باید ۳ تا ۴۰ کاراکتر انگلیسی، عدد، خط تیره یا زیرخط باشد.";
  }

  if (!COUPON_TYPES.includes(data.type)) {
    return "نوع کوپن معتبر نیست.";
  }

  if (
    !Number.isSafeInteger(data.minOrderAmount) ||
    data.minOrderAmount < 0 ||
    data.minOrderAmount > MAX_DB_INT
  ) {
    return "حداقل مبلغ سفارش معتبر نیست.";
  }

  if (data.type === "PERCENTAGE") {
    if (
      !Number.isSafeInteger(data.value) ||
      data.value < 1 ||
      data.value > 100
    ) {
      return "درصد تخفیف باید عددی بین ۱ تا ۱۰۰ باشد.";
    }

    if (
      data.maxDiscountAmount !== null &&
      (
        !Number.isSafeInteger(data.maxDiscountAmount) ||
        data.maxDiscountAmount <= 0 ||
        data.maxDiscountAmount > MAX_DB_INT
      )
    ) {
      return "سقف تخفیف معتبر نیست.";
    }
  } else if (data.type === "FIXED") {
    if (
      !Number.isSafeInteger(data.value) ||
      data.value <= 0 ||
      data.value > MAX_DB_INT
    ) {
      return "مبلغ تخفیف ثابت باید عددی بزرگ‌تر از صفر باشد.";
    }

    if (data.maxDiscountAmount !== null) {
      return "سقف تخفیف فقط برای کوپن درصدی قابل استفاده است.";
    }
  } else if (data.type === "FREE_SHIPPING") {
    if (
      data.value !== null ||
      data.maxDiscountAmount !== null
    ) {
      return "کوپن ارسال رایگان نباید مبلغ یا سقف تخفیف کالا داشته باشد.";
    }
  }

  if (
    data.startsAt &&
    data.expiresAt &&
    data.expiresAt.getTime() <= data.startsAt.getTime()
  ) {
    return "تاریخ پایان باید بعد از تاریخ شروع باشد.";
  }

  if (typeof data.isActive !== "boolean") {
    return "وضعیت فعال بودن کوپن معتبر نیست.";
  }

  if (
    data.description !== null &&
    (
      typeof data.description !== "string" ||
      data.description.length > MAX_DESCRIPTION_LENGTH
    )
  ) {
    return "توضیحات کوپن معتبر نیست.";
  }

  return null;
}

function toCouponData(body) {
  const code = normalizeCouponCode(body.code);

  const type = body.type;

  let value = null;
  let maxDiscountAmount = null;

  if (type === "PERCENTAGE" || type === "FIXED") {
    value = parseMoney(body.value, "value");
  }

  if (
    type === "PERCENTAGE" &&
    body.maxDiscountAmount !== null &&
    body.maxDiscountAmount !== undefined &&
    body.maxDiscountAmount !== ""
  ) {
    maxDiscountAmount = parseMoney(
      body.maxDiscountAmount,
      "maxDiscountAmount",
    );
  }

  return {
    code,
    type,
    value,
    minOrderAmount: parseMoney(
      body.minOrderAmount ?? 0,
      "minOrderAmount",
      { allowZero: true },
    ),
    maxDiscountAmount,
    description: parseDescription(body.description),
    startsAt: parseOptionalDate(body.startsAt, "startsAt"),
    expiresAt: parseOptionalDate(body.expiresAt, "expiresAt"),
    isActive: body.isActive ?? true,
  };
}

function toCouponDTO(coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    minOrderAmount: coupon.minOrderAmount,
    maxDiscountAmount: coupon.maxDiscountAmount,
    description: coupon.description,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt,
    orderCount: coupon._count?.orders ?? 0,
  };
}

const COUPON_SELECT = {
  id: true,
  code: true,
  type: true,
  value: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  description: true,
  startsAt: true,
  expiresAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      orders: true,
    },
  },
};

// GET: فهرست کوپن‌ها فقط برای ادمین
export async function GET(req) {
  const auth = await requireAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status") || "all";
    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 50);

    if (!["all", "active", "inactive"].includes(status)) {
      return jsonError("فیلتر وضعیت کوپن معتبر نیست.");
    }

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return jsonError("اطلاعات صفحه‌بندی معتبر نیست.");
    }

    const where =
      status === "all"
        ? {}
        : { isActive: status === "active" };

    const [coupons, total] = await prisma.$transaction([
      prisma.coupon.findMany({
        where,
        select: COUPON_SELECT,
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),

      prisma.coupon.count({ where }),
    ]);

    return NextResponse.json(
      {
        success: true,
        coupons: coupons.map(toCouponDTO),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("ADMIN GET COUPONS ERROR:", error);

    return jsonError("خطا در دریافت کدهای تخفیف.", 500);
  }
}

// POST: ایجاد کوپن جدید فقط برای ادمین
export async function POST(req) {
  const auth = await requireAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json().catch(() => null);

    if (!isPlainObject(body)) {
      return jsonError("اطلاعات کوپن معتبر نیست.");
    }

    const invalidFields = validateFields(body);

    if (invalidFields) {
      return jsonError(invalidFields);
    }

    let couponData;

    try {
      couponData = toCouponData(body);
    } catch (error) {
      return jsonError(error.message);
    }

    const validationError = validateCouponData(couponData);

    if (validationError) {
      return jsonError(validationError);
    }

    const coupon = await prisma.coupon.create({
      data: couponData,
      select: COUPON_SELECT,
    });

    return NextResponse.json(
      {
        success: true,
        coupon: toCouponDTO(coupon),
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonError(
        "این کد تخفیف قبلاً ثبت شده است.",
        409,
      );
    }

    console.error("ADMIN CREATE COUPON ERROR:", error);

    return jsonError("خطا در ایجاد کد تخفیف.", 500);
  }
}

// PATCH: ویرایش اطلاعات یا وضعیت فعال بودن کوپن
export async function PATCH(req) {
  const auth = await requireAdmin(req);

  if (auth.error) {
    return auth.error;
  }

  try {
    const body = await req.json().catch(() => null);

    if (!isPlainObject(body)) {
      return jsonError("اطلاعات ویرایش کوپن معتبر نیست.");
    }

    const invalidFields = validateFields(body);

    if (invalidFields) {
      return jsonError(invalidFields);
    }

    const id = body.id;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return jsonError("شناسه کوپن معتبر نیست.");
    }

    const existing = await prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      return jsonError("کوپن موردنظر پیدا نشد.", 404);
    }

    // در PATCH فقط فیلدهای ارسال‌شده تغییر می‌کنند.
    const nextType = hasOwn(body, "type")
      ? body.type
      : existing.type;

    const nextCode = hasOwn(body, "code")
      ? normalizeCouponCode(body.code)
      : existing.code;

    const nextValue = hasOwn(body, "value")
      ? (
          body.value === null || body.value === ""
            ? null
            : parseMoney(body.value, "value")
        )
      : (
          nextType === "FREE_SHIPPING"
            ? null
            : existing.value
        );

    const nextMaxDiscountAmount = hasOwn(
      body,
      "maxDiscountAmount",
    )
      ? (
          body.maxDiscountAmount === null ||
          body.maxDiscountAmount === ""
            ? null
            : parseMoney(
                body.maxDiscountAmount,
                "maxDiscountAmount",
              )
        )
      : (
          nextType === "PERCENTAGE"
            ? existing.maxDiscountAmount
            : null
        );

    const nextData = {
      code: nextCode,
      type: nextType,
      value: nextValue,

      minOrderAmount: hasOwn(body, "minOrderAmount")
        ? parseMoney(
            body.minOrderAmount,
            "minOrderAmount",
            { allowZero: true },
          )
        : existing.minOrderAmount,

      maxDiscountAmount: nextMaxDiscountAmount,

      description: hasOwn(body, "description")
        ? parseDescription(body.description)
        : existing.description,

      startsAt: hasOwn(body, "startsAt")
        ? parseOptionalDate(body.startsAt, "startsAt")
        : existing.startsAt,

      expiresAt: hasOwn(body, "expiresAt")
        ? parseOptionalDate(body.expiresAt, "expiresAt")
        : existing.expiresAt,

      isActive: hasOwn(body, "isActive")
        ? body.isActive
        : existing.isActive,
    };

    const validationError = validateCouponData(nextData);

    if (validationError) {
      return jsonError(validationError);
    }

    const coupon = await prisma.coupon.update({
      where: { id },
      data: nextData,
      select: COUPON_SELECT,
    });

    return NextResponse.json(
      {
        success: true,
        coupon: toCouponDTO(coupon),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    if (error?.code === "P2002") {
      return jsonError(
        "این کد تخفیف قبلاً ثبت شده است.",
        409,
      );
    }

    if (error?.code === "P2025") {
      return jsonError("کوپن موردنظر پیدا نشد.", 404);
    }

    if (error instanceof Error && error.message) {
      if (
        error.message.includes("معتبر نیست") ||
        error.message.includes("باید")
      ) {
        return jsonError(error.message);
      }
    }

    console.error("ADMIN UPDATE COUPON ERROR:", error);

    return jsonError("خطا در ویرایش کد تخفیف.", 500);
  }
}
