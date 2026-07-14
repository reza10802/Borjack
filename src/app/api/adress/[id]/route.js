import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { addressSchema } from "@/lib/validations/auth";

export async function PATCH(req, { params }) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const addressId = Number(id);

    const existing = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: auth.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "آدرس پیدا نشد" }, { status: 404 });
    }

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
        where: {
          userId: auth.user.id,
          isDefault: true,
          NOT: { id: addressId },
        },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: {
        fullName,
        phone,
        province,
        city,
        address,
        postalCode,
        isDefault: !!isDefault,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("ADDRESS PATCH ERROR:", error);
    return NextResponse.json(
      { error: "خطا در ویرایش آدرس" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id } = await params;
    const addressId = Number(id);

    const existing = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId: auth.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "آدرس پیدا نشد" }, { status: 404 });
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("ADDRESS DELETE ERROR:", error);
    return NextResponse.json(
      { error: "خطا در حذف آدرس" },
      { status: 500 }
    );
  }
}