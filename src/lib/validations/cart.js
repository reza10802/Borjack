import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z.number().int().positive("شناسه محصول نامعتبر است"),
  quantity: z
    .number()
    .int("تعداد باید عدد صحیح باشد")
    .min(1, "تعداد باید حداقل ۱ باشد")
    .max(20, "تعداد بیش از حد مجاز است"),
});