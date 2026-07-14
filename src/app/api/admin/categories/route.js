import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const categories = await prisma.category.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { title, icon } = await req.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "عنوان دسته‌بندی الزامی است" }, { status: 400 });
  }

  const existing = await prisma.category.findUnique({ where: { title: title.trim() } });
  if (existing) {
    return NextResponse.json({ error: "این دسته‌بندی قبلاً ثبت شده" }, { status: 409 });
  }

  const category = await prisma.category.create({
    data: { title: title.trim()}
  });
  return NextResponse.json({ category }, { status: 201 });
}

export async function DELETE(req) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "شناسه الزامی است" }, { status: 400 });

  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}