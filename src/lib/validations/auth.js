import { z } from "zod";

// ─────────────────────────────────────────────
// Phone helpers
// ─────────────────────────────────────────────

const iranPhoneRegex = /^09\d{9}$/;

function normalizeDigits(value) {
  return value
    .replace(/[۰-۹]/g, (char) =>
      String("۰۱۲۳۴۵۶۷۸۹".indexOf(char))
    )
    .replace(/[٠-٩]/g, (char) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(char))
    );
}

export function normalizeIranPhone(value) {
  let phone = normalizeDigits(String(value ?? "")).trim();

  // حذف فاصله، پرانتز و خط تیره
  phone = phone.replace(/[\s()-]/g, "");

  // حذف + اضافی
  phone = phone.replace(/(?!^)\+/g, "");

  // +98xxxxxxxxxx → 98xxxxxxxxxx
  if (phone.startsWith("+98")) {
    phone = phone.slice(1);
  }

  // 98xxxxxxxxxx → 09xxxxxxxxx
  if (/^989\d{9}$/.test(phone)) {
    return `0${phone.slice(2)}`;
  }

  // 09xxxxxxxxx
  if (/^09\d{9}$/.test(phone)) {
    return phone;
  }

  return null;
}

const iranPhoneSchema = z
  .string()
  .trim()
  .transform((value) => normalizeIranPhone(value))
  .refine(
    (value) =>
      typeof value === "string" &&
      iranPhoneRegex.test(value),
    "شماره موبایل معتبر نیست",
  );

// ─────────────────────────────────────────────
// Common schemas
// ─────────────────────────────────────────────

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const iranPostalCodeRegex = /^\d{10}$/;

const otpPurposeSchema = z.enum([
  "VERIFY_PHONE",
  "RESET_PASSWORD",
]);

// ─────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "نام باید حداقل ۲ کاراکتر باشد")
    .max(100, "نام خیلی طولانی است"),

  phone: iranPhoneSchema,

  password: z
    .string()
    .min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد")
    .max(100, "رمز عبور خیلی طولانی است"),
});

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

export const loginSchema = z.object({
  phone: iranPhoneSchema,

  password: z
    .string()
    .min(1, "رمز عبور الزامی است"),
});

// ─────────────────────────────────────────────
// Send OTP
// ─────────────────────────────────────────────

export const sendOtpSchema = z.object({
  phone: iranPhoneSchema,

  purpose: otpPurposeSchema,
});

// ─────────────────────────────────────────────
// Verify OTP
// ─────────────────────────────────────────────

export const verifyOtpSchema = z.object({
  phone: iranPhoneSchema,

  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "کد تایید باید ۶ رقم باشد"),

  purpose: otpPurposeSchema,
});

// ─────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────

export const addressSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "نام گیرنده الزامی است")
    .max(100, "نام خیلی طولانی است"),

  phone: iranPhoneSchema,

  province: z
    .string()
    .trim()
    .min(2, "استان را انتخاب کنید"),

  city: z
    .string()
    .trim()
    .min(2, "شهر را انتخاب کنید"),

  address: z
    .string()
    .trim()
    .min(10, "آدرس باید حداقل ۱۰ کاراکتر باشد")
    .max(500, "آدرس خیلی طولانی است"),

  postalCode: z
    .string()
    .trim()
    .regex(
      iranPostalCodeRegex,
      "کد پستی باید ۱۰ رقم باشد",
    ),

  isDefault: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────

export const checkoutSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "نام گیرنده الزامی است")
    .max(100, "نام خیلی طولانی است"),

  phone: iranPhoneSchema,

  email: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || emailRegex.test(value),
      "ایمیل معتبر نیست",
    ),

  province: z
    .string()
    .trim()
    .min(2, "استان را انتخاب کنید"),

  city: z
    .string()
    .trim()
    .min(2, "شهر را انتخاب کنید"),

  address: z
    .string()
    .trim()
    .min(10, "آدرس باید حداقل ۱۰ کاراکتر باشد")
    .max(500, "آدرس خیلی طولانی است"),

  postalCode: z
    .string()
    .trim()
    .regex(
      iranPostalCodeRegex,
      "کد پستی باید ۱۰ رقم باشد",
    ),

  saveAddress: z.boolean().optional(),

  addressId: z.number().optional().nullable(),
});

// ─────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────

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
      (value) =>
        !value || iranPostalCodeRegex.test(value),
      "کد پستی معتبر نیست",
    ),
});