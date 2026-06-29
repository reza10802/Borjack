import { NextResponse } from "next/server";
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { requireAdminOrManager } from "@/lib/auth";

const MAX_SIZE = 8 * 1024 * 1024; // 8 مگابایت
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

// POST /api/admin/upload — آپلود عکس محصول، تبدیل به webp، ذخیره با ساختار تاریخی
export async function POST(req) {
    const check = await requireAdminOrManager();
    if (check.error) return check.error;

    try {
        const formData = await req.formData();
        const file = formData.get("image");

        if (!file || typeof file === "string") {
            return NextResponse.json({ error: "فایلی انتخاب نشده" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "فرمت فایل پشتیبانی نمی‌شود (فقط jpg, png, webp, gif, avif)" }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "حجم فایل باید کمتر از ۸ مگابایت باشد" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        const now = new Date();
        const year = String(now.getFullYear());
        const month = String(now.getMonth() + 1).padStart(2, "0");

        const relativeDir = path.join("images", "products", year, month);
        const absoluteDir = path.join(process.cwd(), "public", relativeDir);
        await mkdir(absoluteDir, { recursive: true });

        const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
        const absolutePath = path.join(absoluteDir, filename);

        await sharp(buffer)
            .resize({ width: 1600, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(absolutePath);

        const publicUrl = `/${relativeDir.split(path.sep).join("/")}/${filename}`;

        return NextResponse.json({ url: publicUrl }, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در آپلود تصویر" }, { status: 500 });
    }
}