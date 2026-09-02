import { z } from "zod";

const iranPhoneRegex = /^09\d{9}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const iranPostalCodeRegex = /^\d{10}$/;

const otpPurposeSchema = z.enum([
  "VERIFY_PHONE",
  "RESET_PASSWORD",
]);

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ کاراکتر باشد")
    .max(100, "نام خیلی طولانی است"),

  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  password: z
    .string()
    .min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد")
    .max(100, "رمز عبور خیلی طولانی است"),
});

export const loginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  password: z.string().min(1, "رمز عبور الزامی است"),
});

export const sendOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  purpose: otpPurposeSchema,
});

export const verifyOtpSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "کد تایید باید ۶ رقم باشد"),

  purpose: otpPurposeSchema,
});

export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "نام گیرنده الزامی است")
    .max(100, "نام خیلی طولانی است"),

  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  province: z.string().trim().min(2, "استان را انتخاب کنید"),

  city: z.string().trim().min(2, "شهر را انتخاب کنید"),

  address: z
    .string()
    .trim()
    .min(10, "آدرس باید حداقل ۱۰ کاراکتر باشد")
    .max(500, "آدرس خیلی طولانی است"),

  postalCode: z
    .string()
    .trim()
    .regex(iranPostalCodeRegex, "کد پستی باید ۱۰ رقم باشد"),

  isDefault: z.boolean().optional(),
});

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "نام گیرنده الزامی است")
    .max(100, "نام خیلی طولانی است"),

  phone: z
    .string()
    .trim()
    .regex(iranPhoneRegex, "شماره موبایل معتبر نیست"),

  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || emailRegex.test(value),
      "ایمیل معتبر نیست",
    ),

  province: z.string().trim().min(2, "استان را انتخاب کنید"),

  city: z.string().trim().min(2, "شهر را انتخاب کنید"),

  address: z
    .string()
    .trim()
    .min(10, "آدرس باید حداقل ۱۰ کاراکتر باشد")
    .max(500, "آدرس خیلی طولانی است"),

  postalCode: z
    .string()
    .trim()
    .regex(iranPostalCodeRegex, "کد پستی باید ۱۰ رقم باشد"),

  saveAddress: z.boolean().optional(),

  addressId: z.number().optional().nullable(),
});

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ کاراکتر باشد")
    .max(100, "نام خیلی طولانی است"),

  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || emailRegex.test(value),
      "ایمیل معتبر نیست",
    ),

  address: z
    .string()
    .trim()
    .max(500, "آدرس خیلی طولانی است")
    .optional()
    .or(z.literal("")),

  postalCode: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || iranPostalCodeRegex.test(value),
      "کد پستی معتبر نیست",
    ),
});