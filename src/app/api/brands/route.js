import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: {
        title: "asc",
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return NextResponse.json({
      brands,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "خطا در دریافت برندها",
      },
      {
        status: 500,
      },
    );
  }
}
