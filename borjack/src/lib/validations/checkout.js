import { z } from "zod";

const iranPhoneRegex = /^09\d{9}$/;
const iranPostalCodeRegex = /^\d{10}$/;

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
      invalid_type_error: "شهر را انتخاب کنید",
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
});