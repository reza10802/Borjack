import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  SUPPLIER_ROLE,
  countActiveSupplierProducts,
  retireSupplierProducts,
  writeAuditInTx,
} from "@/lib/supplier-lifecycle";

// Roles an ADMIN may assign from the panel. ADMIN accounts can never be created or changed here.
const ALLOWED_ROLES = ["CUSTOMER", SUPPLIER_ROLE];

const userSelect = {
  id: true,
  name: true,
  phone: true,
  role: true,
  isActive: true,
  _count: { select: { orders: true } },
};

class Refusal extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

// One implementation for PATCH (role and/or isActive) and PUT (isActive): the whole change
// (user update, product retirement, audit entry) runs in ONE transaction on a locked user row.
// If any step fails nothing is applied.
async function changeUser({ admin, id, role, isActive, confirm, blockOnly }) {
  return prisma.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw`
      SELECT "id", "name", "role"::text AS role, "isActive", "isPhoneVerified"
      FROM "User" WHERE "id" = ${id} FOR UPDATE
    `;

    if (!row) throw new Refusal(404, { error: "کاربر پیدا نشد" });

    if (row.role === "ADMIN") {
      throw new Refusal(403, {
        error: blockOnly ? "ادمین قابل مسدود شدن نیست." : "نقش ادمین از این بخش قابل تغییر نیست",
      });
    }

    const nextRole = role ?? row.role;
    const nextActive = isActive ?? row.isActive;
    const roleChanged = nextRole !== row.role;

    // CUSTOMER -> SUPPLIER only for an active account with a verified phone number.
    if (roleChanged && nextRole === SUPPLIER_ROLE) {
      if (!row.isActive || !nextActive) {
        throw new Refusal(409, { error: "فقط حساب فعال می‌تواند تأمین‌کننده شود." });
      }

      if (!row.isPhoneVerified) {
        throw new Refusal(409, { error: "شماره موبایل این کاربر تأیید نشده است؛ تبدیل به تأمین‌کننده ممکن نیست." });
      }
    }

    // A supplier who is demoted or blocked loses all products from sale, atomically.
    const retire = row.role === SUPPLIER_ROLE && (nextRole !== SUPPLIER_ROLE || nextActive === false);
    let retired = { archivedCount: 0, productIds: [], unpublishedOnlyIds: [] };

    if (retire) {
      const productCount = await countActiveSupplierProducts(tx, id);

      if (productCount > 0 && confirm !== true) {
        throw new Refusal(409, {
          error: `با این تغییر ${productCount} محصول این تأمین‌کننده آرشیو و از فروش خارج می‌شود. برای ادامه تأیید کنید.`,
          requiresConfirmation: true,
          productCount,
        });
      }

      retired = await retireSupplierProducts(tx, id);
    }

    const data = {};
    if (roleChanged) data.role = nextRole;
    if (nextActive !== row.isActive) data.isActive = nextActive;

    // Security event: role change / block revokes the user's existing sessions.
    if (roleChanged || nextActive === false) data.tokenVersion = { increment: 1 };

    const user = Object.keys(data).length
      ? await tx.user.update({ where: { id }, data, select: userSelect })
      : await tx.user.findUnique({ where: { id }, select: userSelect });

    if (Object.keys(data).length) {
      const parts = [];
      if (roleChanged) parts.push(`تغییر نقش «${row.name}» از ${row.role} به ${nextRole}`);
      if (nextActive !== row.isActive) parts.push(nextActive ? `کاربر ${row.name} فعال شد` : `کاربر ${row.name} مسدود شد`);
      if (retired.archivedCount) parts.push(`${retired.archivedCount} محصول آرشیو و از فروش خارج شد`);

      await writeAuditInTx(tx, {
        userId: admin.id,
        userLabel: admin.name ?? null,
        action: "UPDATE_USER",
        entityType: "User",
        entityId: id,
        description: parts.join(" | "),
        oldValue: { role: row.role, isActive: row.isActive },
        newValue: {
          role: nextRole,
          isActive: nextActive,
          ...(retire
            ? {
                archivedProductCount: retired.archivedCount,
                archivedProductIds: retired.productIds.slice(0, 500),
                unpublishedOnlyProductIds: retired.unpublishedOnlyIds.slice(0, 500),
              }
            : {}),
        },
      });
    }

    return { user, archivedProducts: retired.archivedCount };
  });
}

function respond(error, fallback) {
  if (error instanceof Refusal) return NextResponse.json(error.body, { status: error.status });
  console.error(error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// PATCH { role?, isActive?, confirm? }
export async function PATCH(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { role, isActive, confirm } = body ?? {};

    if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: "نقش نامعتبر است" }, { status: 400 });
    }

    if (isActive !== undefined && typeof isActive !== "boolean") {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }

    if (role === undefined && isActive === undefined) {
      return NextResponse.json({ error: "نقش یا وضعیت الزامی است" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json({ error: "نمی‌توانید نقش خودتان را تغییر دهید" }, { status: 400 });
    }

    return NextResponse.json(await changeUser({ admin: auth.user, id, role, isActive, confirm }));
  } catch (error) {
    return respond(error, "خطا در تغییر نقش کاربر");
  }
}

// PUT { isActive, confirm? }  (block / unblock)
export async function PUT(req, { params }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { isActive, confirm } = body ?? {};

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
    }

    if (id === auth.user.id) {
      return NextResponse.json({ error: "نمی‌توانید حساب خودتان را مسدود کنید." }, { status: 400 });
    }

    return NextResponse.json(await changeUser({ admin: auth.user, id, isActive, confirm, blockOnly: true }));
  } catch (error) {
    return respond(error, "خطا در تغییر وضعیت کاربر");
  }
}
