import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

export async function GET(req) {
    try {
        const token = req.cookies.get("token")?.value;

        if (!token) {
            return NextResponse.json({ error: "لاگین نشدی" }, { status: 401 });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        return NextResponse.json({
            id: decoded.id,
            name: decoded.name,
            identifier: decoded.identifier,
        });

    } catch (error) {
        return NextResponse.json({ error: "توکن نامعتبر" }, { status: 401 });
    }
}