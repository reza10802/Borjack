import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { addressSchema } from "@/lib/validations/auth";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const addresses = await prisma.address.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(addresses);
  } catch (error) {
    console.error("ADDRESS GET ERROR:", error);
    return NextResponse.json(
      { error: "خطا در دریافت آدرس‌ها" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = addressSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { fullName, phone, province, city, address, postalCode, isDefault } =
      parsed.data;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId: auth.user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.address.create({
      data: {
        userId: auth.user.id,
        fullName,
        phone,
        province,
        city,
        address,
        postalCode,
        isDefault: !!isDefault,
      },
    });

    return NextResponse.json(newAddress, { status: 201 });
  } catch (error) {
    console.error("ADDRESS POST ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ثبت آدرس" },
      { status: 500 }
    );
  }
}