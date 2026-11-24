import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  requireRoles,
  ROLES,
} from "@/lib/auth";

// ساخت slug از عنوان فارسی یا انگلیسی
function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

// تولید slug یکتا
async function generateUniqueSlug(title) {
  const baseSlug = slugify(title);

  if (!baseSlug) {
    throw new Error("INVALID_CATEGORY_SLUG");
  }

  let slug = baseSlug;
  let suffix = 1;

  while (
    await prisma.category.findUnique({
      where: { slug },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix++}`;
  }

  return slug;
}

// GET: مشاهده دسته‌بندی‌ها برای ادمین و تأمین‌کننده
export async function GET() {
  const check = await requireRoles([
    ROLES.ADMIN,
    ROLES.SUPPLIER,
  ]);

  if (check.error) return check.error;

  try {
    const categories = await prisma.category.findMany({
      orderBy: { title: "asc" },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("GET CATEGORIES ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    return NextResponse.json(
      { error: "خطا در دریافت دسته‌بندی‌ها" },
      { status: 500 }
    );
  }
}

// POST: ایجاد دسته‌بندی فقط توسط ادمین
export async function POST(req) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;

  try {
    const body = await req.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "اطلاعات ارسالی معتبر نیست" },
        { status: 400 }
      );
    }

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    if (!title) {
      return NextResponse.json(
        { error: "عنوان دسته‌بندی الزامی است" },
        { status: 400 }
      );
    }

    // جلوگیری از ثبت عنوان تکراری
    const existing = await prisma.category.findUnique({
      where: { title },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "این دسته‌بندی قبلاً ثبت شده" },
        { status: 409 }
      );
    }

    // تولید آدرس یکتا برای دسته‌بندی
    const slug = await generateUniqueSlug(title);

    const category = await prisma.category.create({
      data: {
        title,
        slug,
      },
    });

    return NextResponse.json(
      {
        success: true,
        category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error?.message === "INVALID_CATEGORY_SLUG") {
      return NextResponse.json(
        { error: "عنوان دسته‌بندی برای ساخت آدرس معتبر نیست" },
        { status: 400 }
      );
    }

    if (error?.code === "P2002") {
      return NextResponse.json(
        { error: "این عنوان یا آدرس دسته‌بندی قبلاً ثبت شده است." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "خطا در ایجاد دسته‌بندی" },
      { status: 500 }
    );
  }
}

// DELETE: حذف دسته‌بندی فقط توسط ادمین
export async function DELETE(req) {
  const check = await requireAdmin(req);
  if (check.error) return check.error;

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "شناسه دسته‌بندی معتبر نیست" },
        { status: 400 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", {
      message: error?.message,
      code: error?.code,
    });

    if (error?.code === "P2025") {
      return NextResponse.json(
        { error: "دسته‌بندی موردنظر پیدا نشد" },
        { status: 404 }
      );
    }

    if (error?.code === "P2003") {
      return NextResponse.json(
        { error: "این دسته‌بندی به محصولاتی متصل است و قابل حذف نیست." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "حذف دسته‌بندی انجام نشد" },
      { status: 500 }
    );
  }
}