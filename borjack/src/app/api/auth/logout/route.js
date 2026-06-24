import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ message: "خروج موفق" });
    response.cookies.delete("token");
    return response;
}