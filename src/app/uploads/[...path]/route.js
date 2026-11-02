export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.resolve(
    process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads")
);

export async function GET(_req, { params }) {
    try {
        const { path: segments } = await params;

        if (
            !Array.isArray(segments) ||
            segments.length !== 4 ||
            segments[0] !== "products" ||
            !/^\d{4}$/.test(segments[1]) ||
            !/^(0[1-9]|1[0-2])$/.test(segments[2]) ||
            !/^\d+-[a-f0-9]{8}\.webp$/.test(segments[3])
        ) {
            return new NextResponse("Not found", { status: 404 });
        }

        const filePath = path.resolve(UPLOAD_DIR, ...segments);
        const relativePath = path.relative(UPLOAD_DIR, filePath);

        if (
            !relativePath ||
            relativePath.startsWith("..") ||
            path.isAbsolute(relativePath)
        ) {
            return new NextResponse("Not found", { status: 404 });
        }

        const fileStat = await stat(filePath);

        if (!fileStat.isFile()) {
            return new NextResponse("Not found", { status: 404 });
        }

        const file = await readFile(filePath);

        return new NextResponse(new Uint8Array(file), {
            headers: {
                "Content-Type": "image/webp",
                "Content-Length": String(file.length),
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
            },
        });
    } catch {
        return new NextResponse("Not found", { status: 404 });
    }
}