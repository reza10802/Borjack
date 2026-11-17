
// Supplier lifecycle: what happens to a supplier's products when the account stops being a
// usable supplier (demoted to CUSTOMER or blocked), and who may (re)publish a product.
//
// Hard rules:
//  * Lifecycle operations run inside the caller's transaction.
//  * Products are archived with deletedAt AND unpublished.
//  * stock, reservedStock, reservations and order history are NEVER changed.
//  * Rows are locked in ascending id order when retiring multiple products.
//  * A product can only be published after admin approval.
//  * Review status and publication status are independent.

import { headers } from "next/headers";
import { getClientIp, redactSensitive } from "@/lib/security";

export const SUPPLIER_ROLE = "SUPPLIER";

export const PRODUCT_REVIEW_STATUSES = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
});

const MAX_REVIEW_NOTE_LENGTH = 1000;

async function requestIp() {
  try {
    const ip = getClientIp(await headers());
    return ip === "unknown" ? null : ip;
  } catch {
    return null;
  }
}

// Audit entry written through the SAME transaction client.
// If the log cannot be written, the whole operation rolls back.
export async function writeAuditInTx(
  tx,
  {
    userId,
    userLabel = null,
    action,
    entityType,
    entityId,
    description,
    oldValue = null,
    newValue = null,
  }
) {
  await tx.auditLog.create({
    data: {
      userId,
      userLabel,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      description,
      oldValue: redactSensitive(oldValue),
      newValue: redactSensitive(newValue),
      ipAddress: await requestIp(),
    },
  });
}

// Number of products that a retirement would archive right now.
export async function countActiveSupplierProducts(client, userId) {
  return client.product.count({
    where: {
      supplierId: userId,
      deletedAt: null,
    },
  });
}

// Archives + unpublishes every product owned by userId.
// Also unpublishes products that were already archived but still flagged published.
export async function retireSupplierProducts(tx, userId) {
  const rows = await tx.$queryRaw`
    SELECT
      "id"::int AS id,
      ("deletedAt" IS NULL) AS was_active
    FROM "Product"
    WHERE
      "supplierId" = ${userId}
      AND ("deletedAt" IS NULL OR "isPublished" = TRUE)
    ORDER BY "id" ASC
    FOR UPDATE
  `;

  if (!rows.length) {
    return {
      archivedCount: 0,
      productIds: [],
      unpublishedOnlyIds: [],
    };
  }

  const ids = rows.map((row) => row.id);

  await tx.$executeRaw`
    UPDATE "Product"
    SET
      "deletedAt" = COALESCE("deletedAt", now()),
      "isPublished" = FALSE,
      "updatedAt" = now()
    WHERE "id" = ANY(${ids}::int[])
  `;

  // Remove retired products from users' carts.
  await tx.cartItem.deleteMany({
    where: {
      productId: {
        in: ids,
      },
    },
  });

  const productIds = rows
    .filter((row) => row.was_active)
    .map((row) => row.id);

  const unpublishedOnlyIds = rows
    .filter((row) => !row.was_active)
    .map((row) => row.id);

  return {
    archivedCount: productIds.length,
    productIds,
    unpublishedOnlyIds,
  };
}

// NULL owner means Borjak itself.
// A supplier-owned product is eligible only while its owner is an active SUPPLIER.
export function isEligibleOwner(owner) {
  return (
    !owner ||
    (owner.role === SUPPLIER_ROLE && owner.isActive === true)
  );
}

export class PublishRefusal extends Error {
  constructor(status, message) {
    super(message);
    this.name = "PublishRefusal";
    this.status = status;
  }
}

export class ReviewRefusal extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ReviewRefusal";
    this.status = status;
  }
}

// Admin approval / rejection of a product.
// Approval does NOT publish automatically.
// Rejection always unpublishes the product and requires a reason.
export async function setProductReviewStatus(
  tx,
  productId,
  reviewStatus,
  reviewNote = null
) {
  if (
    reviewStatus !== PRODUCT_REVIEW_STATUSES.APPROVED &&
    reviewStatus !== PRODUCT_REVIEW_STATUSES.REJECTED
  ) {
    throw new ReviewRefusal(
      400,
      "وضعیت بررسی محصول معتبر نیست"
    );
  }

  const normalizedNote =
    typeof reviewNote === "string"
      ? reviewNote.trim()
      : "";

  if (
    reviewStatus === PRODUCT_REVIEW_STATUSES.REJECTED &&
    !normalizedNote
  ) {
    throw new ReviewRefusal(
      400,
      "برای رد محصول، ثبت دلیل الزامی است"
    );
  }

  if (normalizedNote.length > MAX_REVIEW_NOTE_LENGTH) {
    throw new ReviewRefusal(
      400,
      `متن پیام نمی‌تواند بیشتر از ${MAX_REVIEW_NOTE_LENGTH} کاراکتر باشد`
    );
  }

  // Lock product before reading and changing its review state.
  const [row] = await tx.$queryRaw`
    SELECT
      p."id"::int AS id,
      p."title",
      p."reviewStatus"::text AS review_status,
      p."reviewNote" AS review_note,
      p."isPublished",
      p."deletedAt"
    FROM "Product" p
    WHERE p."id" = ${productId}
    FOR UPDATE OF p
  `;

  if (!row) {
    throw new ReviewRefusal(404, "محصول پیدا نشد");
  }

  if (row.deletedAt) {
    throw new ReviewRefusal(
      409,
      "محصول آرشیوشده قابل بررسی نیست؛ ابتدا آن را بازیابی کنید."
    );
  }

  // Approval clears the previous review message.
  // Rejection stores the required reason and unpublishes the product.
  const nextReviewNote =
    reviewStatus === PRODUCT_REVIEW_STATUSES.REJECTED
      ? normalizedNote
      : null;

  const nextIsPublished =
    reviewStatus === PRODUCT_REVIEW_STATUSES.REJECTED
      ? false
      : row.isPublished;

  const changed =
    row.review_status !== reviewStatus ||
    row.review_note !== nextReviewNote ||
    row.isPublished !== nextIsPublished;

  if (!changed) {
    return {
      id: row.id,
      title: row.title,
      reviewStatus,
      reviewNote: nextReviewNote,
      isPublished: nextIsPublished,
      changed: false,
    };
  }

  const product = await tx.product.update({
    where: {
      id: productId,
    },
    data: {
      reviewStatus,
      reviewNote: nextReviewNote,
      isPublished: nextIsPublished,
    },
    select: {
      id: true,
      title: true,
      reviewStatus: true,
      reviewNote: true,
      isPublished: true,
    },
  });

  return {
    ...product,
    changed: true,
    oldValue: {
      reviewStatus: row.review_status,
      reviewNote: row.review_note,
      isPublished: row.isPublished,
    },
    newValue: {
      reviewStatus: product.reviewStatus,
      reviewNote: product.reviewNote,
      isPublished: product.isPublished,
    },
  };
}

// Admin-only publish / unpublish of one product.
//
// Publishing is refused for:
// - archived products
// - products whose owner is not an active SUPPLIER
// - products that have not been approved
//
// Unpublishing requires a message for the supplier.
// Publication status and review status remain independent.
export async function setProductPublished(
  tx,
  productId,
  publish,
  reviewNote = null
) {
  if (typeof publish !== "boolean") {
    throw new PublishRefusal(
      400,
      "وضعیت انتشار معتبر نیست"
    );
  }

  const normalizedNote =
    typeof reviewNote === "string"
      ? reviewNote.trim()
      : "";

  if (!publish && !normalizedNote) {
    throw new PublishRefusal(
      400,
      "برای خارج‌کردن محصول از انتشار، ثبت دلیل یا پیام الزامی است"
    );
  }

  if (normalizedNote.length > MAX_REVIEW_NOTE_LENGTH) {
    throw new PublishRefusal(
      400,
      `متن پیام نمی‌تواند بیشتر از ${MAX_REVIEW_NOTE_LENGTH} کاراکتر باشد`
    );
  }

  const [row] = await tx.$queryRaw`
    SELECT
      p."id"::int AS id,
      p."isPublished",
      p."deletedAt",
      p."supplierId",
      p."reviewStatus"::text AS review_status,
      p."reviewNote" AS review_note,
      u.role::text AS owner_role,
      u."isActive" AS owner_active
    FROM "Product" p
    LEFT JOIN "User" u ON u."id" = p."supplierId"
    WHERE p."id" = ${productId}
    FOR UPDATE OF p
  `;

  if (!row) {
    throw new PublishRefusal(404, "محصول پیدا نشد");
  }

  if (publish) {
    if (row.deletedAt) {
      throw new PublishRefusal(
        409,
        "محصول آرشیو شده است؛ ابتدا آن را بازیابی کنید."
      );
    }

    if (
      row.supplierId &&
      !isEligibleOwner({
        role: row.owner_role,
        isActive: row.owner_active,
      })
    ) {
      throw new PublishRefusal(
        409,
        "مالک این محصول دیگر تأمین‌کننده فعال نیست؛ انتشار محصول ممکن نیست."
      );
    }

    if (
      row.review_status !== PRODUCT_REVIEW_STATUSES.APPROVED
    ) {
      throw new PublishRefusal(
        409,
        "این محصول هنوز توسط ادمین تأیید نشده است؛ ابتدا آن را تأیید کنید."
      );
    }
  }

  // Publishing clears the previous moderation message.
  // Unpublishing stores the administrator's message.
  const nextReviewNote = publish ? null : normalizedNote;

  const changed =
    row.isPublished !== publish ||
    row.review_note !== nextReviewNote;

  if (!changed) {
    return {
      id: row.id,
      isPublished: publish,
      reviewNote: nextReviewNote,
      changed: false,
    };
  }

  await tx.product.update({
    where: {
      id: productId,
    },
    data: {
      isPublished: publish,
      reviewNote: nextReviewNote,
    },
  });

  return {
    id: row.id,
    isPublished: publish,
    reviewNote: nextReviewNote,
    changed: true,
    oldValue: {
      isPublished: row.isPublished,
      reviewNote: row.review_note,
    },
    newValue: {
      isPublished: publish,
      reviewNote: nextReviewNote,
    },
  };
}
