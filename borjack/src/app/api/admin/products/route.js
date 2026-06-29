import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/auth";
import { createAuditLog } from "../../../../lib/auditLog";
 
export async function GET() {
  const { session, error } = await requireAdmin();
  if (error) return error;
 
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });
 
  return NextResponse.json({ products });
}
 
export async function POST(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;
 
  const body = await req.json();
  const { title, price, originalPrice, discount, category, image, description, inStock } = body;
 
  const product = await prisma.product.create({
    data: { title, price, originalPrice, discount, category, image, description, inStock },
  });
 
  await createAuditLog({
    userId: session.id,
    action: "CREATE_PRODUCT",
    entityType: "Product",
    entityId: product.id,
    description: `ایجاد کالا "${title}"`,
    newValue: product,
  });
 
  return NextResponse.json({ product }, { status: 201 });
}
 
export async function PATCH(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;
 
  const body = await req.json();
  const { id, ...data } = body;
 
  const before = await prisma.product.findUnique({ where: { id } });
 
  const product = await prisma.product.update({
    where: { id },
    data,
  });
 
  await createAuditLog({
    userId: session.id,
    action: "UPDATE_PRODUCT",
    entityType: "Product",
    entityId: id,
    description: `ویرایش کالا "${product.title}"`,
    oldValue: before,
    newValue: product,
  });
 
  return NextResponse.json({ product });
}
 
export async function DELETE(req) {
  const { session, error } = await requireAdmin();
  if (error) return error;
 
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
 
  const before = await prisma.product.findUnique({ where: { id } });
 
  await prisma.product.delete({ where: { id } });
 
  await createAuditLog({
    userId: session.id,
    action: "DELETE_PRODUCT",
    entityType: "Product",
    entityId: id,
    description: `حذف کالا "${before?.title}"`,
    oldValue: before,
  });
 
  return NextResponse.json({ success: true });
}