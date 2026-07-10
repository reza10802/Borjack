import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "توکن نامعتبر" }, { status: 401 });
  }
}