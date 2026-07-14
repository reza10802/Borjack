import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validations/auth";

export async function PATCH(req) {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نیستی" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      const firstError =
        parsed.error.issues[0]?.message || "اطلاعات نامعتبر است";

      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, address, postalCode } = parsed.data;

    if (email) {
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
      data: {
        name,
        email: email || null,
        address,
        postalCode,
      },
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

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "خطا در بروزرسانی اطلاعات" },
      { status: 500 }
    );
  }
}