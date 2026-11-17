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
  "LOGIN",
]);


// ─────────────────────────────────────────────
// Password policy (bcrypt ignores bytes beyond 72, so we cap at 72 UTF-8 bytes)
// ─────────────────────────────────────────────
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "12341234", "11111111", "00000000", "87654321", "987654321",
  "password", "password1", "password123", "qwerty123", "qwertyui", "asdfghjk", "iloveyou", "admin123",
  "admin1234", "abc12345", "a1234567", "aa123456", "1q2w3e4r", "123123123", "09123456789", "borjak123",
]);

export const strongPasswordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "رمز عبور خیلی طولانی است")
  .refine((v) => !COMMON_PASSWORDS.has(v.toLowerCase()), "این رمز عبور بسیار رایج است؛ رمز دیگری انتخاب کنید")
  .refine((v) => !/^(.)\1+$/.test(v), "رمز عبور نباید تکرار یک کاراکتر باشد")
  .refine((v) => !(/^\d+$/.test(v) && v.length < 12), "رمز عبور نباید فقط عدد باشد (ترکیبی از حروف و عدد استفاده کنید)");

const otpCodeNormalizer = (value) =>
  String(value ?? "")
    .trim()
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));

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

  password: strongPasswordSchema,
});

// ─────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────

export const loginSchema = z.object({
  phone: iranPhoneSchema,
  password: z.string().min(1, "رمز عبور الزامی است"),
  captchaToken: z.string().max(2048).optional(),
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
    .transform(otpCodeNormalizer)
    .refine((v) => /^\d{6}$/.test(v), "کد تایید باید ۶ رقم باشد"),

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