import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";
import { createAuditLog } from "../../../../lib/auditLog";

export async function GET(request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const products = await prisma.product.findMany({
    select: {
      id: true,
      title: true,
      category: true,
      inStock: true,
      price: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ products });
}

export async function PATCH(request) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { productId, inStock } = body;

  if (typeof productId !== "number" || typeof inStock !== "boolean") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const before = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, inStock: true },
  });

  if (!before) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { inStock },
    select: { id: true, title: true, inStock: true },
  });

  await createAuditLog({
    userId: session.id,
    action: "UPDATE_STOCK",
    entityType: "Product",
    entityId: productId,
    description: `تغییر موجودی "${before.title}" از ${before.inStock} به ${inStock}`,
    oldValue: { inStock: before.inStock },
    newValue: { inStock },
  });

  return NextResponse.json({ product: updated });
}