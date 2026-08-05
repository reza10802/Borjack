import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
      },
    });

    return NextResponse.json({
      tags,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "خطا در دریافت تگ‌ها",
      },
      {
        status: 500,
      }
    );
  }
}