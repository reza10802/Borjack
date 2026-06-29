import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireAdmin, logAction } from "../../../../lib/auth";

// فقط بین CUSTOMER و MANAGER می‌شه از طریق پنل تغییر داد.
// ارتقا به ADMIN عمداً از این مسیر مجاز نیست؛ باید دستی توی دیتابیس انجام شه تا کسی به‌اشتباه/سوءاستفاده مدیر اصلی نشه.
const ALLOWED_ROLES = ["CUSTOMER", "MANAGER"];

// PATCH /api/admin/users/[id] — تغییر نقش یک کاربر (فقط ADMIN)
export async function PATCH(req, { params }) {
    const check = await requireAdmin(req);
    if (check.error) {
        return NextResponse.json({ error: check.error }, { status: check.status });
    }

    try {
        const { id } = await params;
        const { role } = await req.json();

        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ error: "این نقش از این بخش قابل تنظیم نیست" }, { status: 400 });
        }

        if (id === check.user.id) {
            return NextResponse.json({ error: "نمی‌تونی نقش خودت رو از همینجا تغییر بدی" }, { status: 400 });
        }

        const before = await prisma.user.findUnique({ where: { id } });
        if (!before) {
            return NextResponse.json({ error: "کاربر پیدا نشد" }, { status: 404 });
        }
        if (before.role === "ADMIN") {
            return NextResponse.json({ error: "نقش مدیر اصلی از این بخش قابل تغییر نیست" }, { status: 403 });
        }

        const user = await prisma.user.update({
            where: { id },
            data: { role },
            select: { id: true, name: true, identifier: true, role: true },
        });

        await logAction(req, {
            userId: check.user.id,
            action: "UPDATE_USER",
            entityType: "User",
            entityId: id,
            description: `نقش کاربر «${before.name}» تغییر کرد`,
            oldValue: { role: before.role },
            newValue: { role },
        });

        return NextResponse.json(user);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "خطا در ویرایش کاربر" }, { status: 500 });
    }
}