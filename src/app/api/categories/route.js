
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        products: {
          some: {
            isPublished: true,
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
      },
      orderBy: {
        title: "asc",
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("Failed to load public categories:", error);

    return NextResponse.json(
      { error: "Unable to load categories" },
      { status: 500 }
    );
  }
}
