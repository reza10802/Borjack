
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validations/auth";

export async function PATCH(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نیستی" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }

    const { name, email, address, postalCode } = parsed.data;

    const hasField = (field) =>
      Object.prototype.hasOwnProperty.call(body, field);

    // فقط فیلدهای ارسال‌شده تغییر می‌کنند.
    const updateData = { name };

    if (hasField("email")) {
      updateData.email = email || null;
    }

    if (hasField("address")) {
      updateData.address = address;
    }

    if (hasField("postalCode")) {
      updateData.postalCode = postalCode;
    }

    // بررسی تکراری نبودن ایمیل، فقط در صورت ارسال ایمیل جدید
    if (hasField("email") && email) {
      const existingEmailUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: {
            id: user.id,
          },
        },
      });

      if (existingEmailUser) {
        return NextResponse.json(
          { error: "این ایمیل قبلاً استفاده شده است" },
          { status: 409 }
        );
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        address: true,
        postalCode: true,
      },
    });

    // همگام‌سازی آدرس پیش‌فرض، در صورت ارسال اطلاعات آدرس
    const addrData = {};

    if (
      hasField("address") &&
      typeof address === "string" &&
      address.trim()
    ) {
      addrData.address = address.trim();
    }

    if (
      hasField("postalCode") &&
      typeof postalCode === "string" &&
      postalCode.trim()
    ) {
      addrData.postalCode = postalCode.trim();
    }

    if (Object.keys(addrData).length > 0) {
      await prisma.address.updateMany({
        where: {
          userId: user.id,
          isDefault: true,
        },
        data: addrData,
      });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error(
      "PROFILE_UPDATE_ERROR:",
      error?.name || "error"
    );

    return NextResponse.json(
      { error: "خطا در بروزرسانی اطلاعات" },
      { status: 500 }
    );
  }
}
