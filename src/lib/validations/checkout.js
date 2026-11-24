
import { z } from "zod";

const iranPhoneRegex = /^09\d{9}$/;
const iranPostalCodeRegex = /^\d{10}$/;
const couponCodeRegex = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export const SHIPPING_METHODS = [
  "POST",
  "POST_EXPRESS",
];

export const checkoutSchema = z.object({
  receiverName: z
    .string()
    .trim()
    .min(3, "نام گیرنده باید حداقل ۳ کاراکتر باشد")
    .max(100, "نام گیرنده خیلی طولانی است"),

  receiverPhone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل گیرنده معتبر نیست"),

  provinceId: z.coerce
    .number({
      invalid_type_error: "استان را انتخاب کنید",
    })
    .int("استان نامعتبر است")
    .positive("استان نامعتبر است"),

  cityId: z.coerce
    .number({
      invalid_type_error: "شهر نامعتبر است",
    })
    .int("شهر نامعتبر است")
    .positive("شهر نامعتبر است"),

  address: z
    .string()
    .trim()
    .min(10, "آدرس باید حداقل ۱۰ کاراکتر باشد")
    .max(500, "آدرس خیلی طولانی است"),

  postalCode: z
    .string()
    .trim()
    .regex(iranPostalCodeRegex, "کد پستی باید ۱۰ رقم باشد"),

  // کد تخفیف فروشگاه؛ محاسبه و اعتبارسنجی نهایی فقط در سرور انجام می‌شود.
  couponCode: z
    .string()
    .trim()
    .max(40, "کد تخفیف بیش از حد طولانی است")
    .refine(
      (value) =>
        value === "" ||
        couponCodeRegex.test(value.toUpperCase()),
      "فرمت کد تخفیف معتبر نیست"
    )
    .transform((value) => value.toUpperCase())
    .optional()
    .default(""),

  // روش ارسال مستقل برای هر گروه فروشنده
  shippingMethodsBySeller: z
    .record(
      z.string().regex(
        /^seller-\d+$/,
        "شناسه گروه فروشنده معتبر نیست"
      ),
      z.enum(SHIPPING_METHODS, {
        errorMap: () => ({
          message: "روش ارسال انتخاب‌شده معتبر نیست",
        }),
      })
    )
    .default({}),

  // درخواست اختیاری فاکتور چاپی
  requiresPrintedInvoice: z.boolean().default(false),
});
