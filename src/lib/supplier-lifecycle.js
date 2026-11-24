
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
//  * A previously published product may be republished after re-approval.
//  * A new or previously unpublished product is never auto-published.

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
      "republishAfterReview" = FALSE,
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
//
// Approval behavior:
// - New products remain unpublished.
// - Previously unpublished products remain unpublished.
// - Products that were published before a supplier edit are republished
//   after approval, provided their supplier is still eligible.
//
// Rejection always unpublishes the product and requires a reason.
// The republish flag is retained after rejection so a corrected product
// can be resubmitted and republished after a later approval.
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

  // Lock product and read the owner state before changing its review state.
  const [row] = await tx.$queryRaw`
    SELECT
      p."id"::int AS id,
      p."title",
      p."reviewStatus"::text AS review_status,
      p."reviewNote" AS review_note,
      p."isPublished",
      p."republishAfterReview" AS republish_after_review,
      p."deletedAt",
      p."supplierId" AS supplier_id,
      u.role::text AS owner_role,
      u."isActive" AS owner_active
    FROM "Product" p
    LEFT JOIN "User" u ON u."id" = p."supplierId"
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

  const nextReviewNote =
    reviewStatus === PRODUCT_REVIEW_STATUSES.REJECTED
      ? normalizedNote
      : null;

  const ownerEligible =
    !row.supplier_id ||
    isEligibleOwner({
      role: row.owner_role,
      isActive: row.owner_active,
    });

  // Only restore publication when the product was published before
  // the supplier's content edit and its owner is still eligible.
  const shouldRepublish =
    reviewStatus === PRODUCT_REVIEW_STATUSES.APPROVED &&
    row.republish_after_review === true &&
    ownerEligible;

  const nextIsPublished =
    reviewStatus === PRODUCT_REVIEW_STATUSES.REJECTED
      ? false
      : row.republish_after_review
        ? shouldRepublish
        : row.isPublished;

  // Clear the flag after a successful automatic republish.
  // Keep it after rejection, or if the owner is not eligible yet.
  const nextRepublishAfterReview =
    shouldRepublish
      ? false
      : row.republish_after_review;

  const changed =
    row.review_status !== reviewStatus ||
    row.review_note !== nextReviewNote ||
    row.isPublished !== nextIsPublished ||
    row.republish_after_review !== nextRepublishAfterReview;

  if (!changed) {
    return {
      id: row.id,
      title: row.title,
      reviewStatus,
      reviewNote: nextReviewNote,
      isPublished: nextIsPublished,
      republishAfterReview: nextRepublishAfterReview,
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
      republishAfterReview: nextRepublishAfterReview,
    },
    select: {
      id: true,
      title: true,
      reviewStatus: true,
      reviewNote: true,
      isPublished: true,
      republishAfterReview: true,
    },
  });

  return {
    ...product,
    changed: true,
    oldValue: {
      reviewStatus: row.review_status,
      reviewNote: row.review_note,
      isPublished: row.isPublished,
      republishAfterReview: row.republish_after_review,
    },
    newValue: {
      reviewStatus: product.reviewStatus,
      reviewNote: product.reviewNote,
      isPublished: product.isPublished,
      republishAfterReview: product.republishAfterReview,
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
// Explicit admin publication decisions clear the automatic-republish flag.
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
      p."republishAfterReview" AS republish_after_review,
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

  const nextReviewNote = publish ? null : normalizedNote;
  const nextRepublishAfterReview = false;

  const changed =
    row.isPublished !== publish ||
    row.review_note !== nextReviewNote ||
    row.republish_after_review !== nextRepublishAfterReview;

  if (!changed) {
    return {
      id: row.id,
      isPublished: publish,
      reviewNote: nextReviewNote,
      republishAfterReview: nextRepublishAfterReview,
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
      republishAfterReview: nextRepublishAfterReview,
    },
  });

  return {
    id: row.id,
    isPublished: publish,
    reviewNote: nextReviewNote,
    republishAfterReview: nextRepublishAfterReview,
    changed: true,
    oldValue: {
      isPublished: row.isPublished,
      reviewNote: row.review_note,
      republishAfterReview: row.republish_after_review,
    },
    newValue: {
      isPublished: publish,
      reviewNote: nextReviewNote,
      republishAfterReview: nextRepublishAfterReview,
    },
  };
}
