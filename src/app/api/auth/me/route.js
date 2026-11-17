
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, private",
};

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: "لاگین نشدی" },
        {
          status: 401,
          headers: NO_STORE_HEADERS,
        }
      );
    }

    return NextResponse.json(user, {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("AUTH ME ERROR:", error);

    return NextResponse.json(
      { error: "توکن نامعتبر" },
      {
        status: 401,
        headers: NO_STORE_HEADERS,
      }
    );
  }
}
