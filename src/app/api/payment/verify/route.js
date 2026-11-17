
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ZARINPAL_GATEWAY_NAME,
} from "@/lib/zarinpal";
import { settleCanceledPayment, settlePaidOrder } from "@/lib/payment-settlement";
import { inquireAuthority, verifyAuthority } from "@/lib/payment-recon";

function getSiteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://borjak.site";

  try {
    return new URL(raw).origin;
  } catch {
    return "https://borjak.site";
  }
}

function getPaidRedirectPath(order) {
  return order.stockReservationStatus === "ISSUE" || order.stockIssueAt
    ? "/profile?payment=paid-stock-issue"
    : "/profile?payment=success";
}

export async function GET(req) {
  const siteUrl = getSiteUrl();

  const redirectTo = (path) =>
    NextResponse.redirect(new URL(path, siteUrl));

  let orderId = null;

  try {
    const { searchParams } = new URL(req.url);

    const authority = searchParams.get("Authority");
    const gatewayStatus = searchParams.get("Status");

    if (!authority || authority.length > 100) {
      return redirectTo("/?payment=failed");
    }

    const order = await prisma.order.findUnique({
      where: { authority },
      include: {
        transaction: true,
        items: true,
      },
    });

    if (!order) {
      // Authority superseded by a newer payment request? Keep a trail instead of silently dropping it.
      const attempt = await prisma.paymentAttempt.findUnique({ where: { authority } });
      if (attempt && attempt.status !== "PAID") {
        const inquiry = await inquireAuthority({ authority });
        if (inquiry.state === "PAID" || inquiry.state === "VERIFIED" || inquiry.state === "REVERSED") {
          // A superseded Authority can no longer settle the current order.
          // On Status=NOK, do not call Verify; preserve it for manual financial review.
          if (gatewayStatus === "OK" && (inquiry.state === "PAID" || inquiry.state === "VERIFIED")) {
            const verification = await verifyAuthority({ authority, total: attempt.amount });
            await prisma.paymentAttempt.update({
              where: { authority },
              data: {
                status: "REVIEW",
                refId: verification.refId ?? undefined,
                note: verification.state === "PAID"
                  ? "paid on a superseded authority - manual financial review required"
                  : "superseded authority Inquiry reports paid/verified but Verify is not confirmed - manual review required",
              },
            });
            console.error("ZARINPAL_SUPERSEDED_AUTHORITY_REQUIRES_REVIEW", { orderId: attempt.orderId, authority, verifyState: verification.state });
            return redirectTo("/profile?payment=verify-error");
          } else {
            await prisma.paymentAttempt.update({
              where: { authority },
              data: {
                status: "REVIEW",
                note: inquiry.state === "REVERSED"
                  ? "superseded authority is REVERSED at gateway - manual financial review required"
                  : "superseded authority appears paid/verified but callback Status is not OK - manual financial review required",
              },
            });
            return redirectTo("/profile?payment=verify-error");
          }
        }
        if (inquiry.state === "FAILED") {
          await prisma.paymentAttempt.updateMany({ where: { authority, status: "PENDING" }, data: { status: "FAILED", note: "ZarinPal Inquiry status FAILED" } });
        }
      }
      return redirectTo("/?payment=order-not-found");
    }

    orderId = order.id;

    // Callback تکراری برای سفارش پرداخت‌شده
    if (order.paymentStatus === "PAID") {
      return redirectTo(getPaidRedirectPath(order));
    }

    if (order.paymentStatus !== "PENDING") {
      return redirectTo("/profile?payment=failed");
    }

    const transaction = order.transaction;

    const validTransaction =
      transaction &&
      transaction.authority === authority &&
      Number(transaction.amount) === Number(order.total) &&
      transaction.gateway === ZARINPAL_GATEWAY_NAME &&
      ["PENDING", "FAILED"].includes(transaction.status);

    if (!validTransaction) {
      console.error("ZARINPAL_TRANSACTION_MISMATCH", {
        orderId: order.id,
        transactionExists: Boolean(transaction),
        transactionGateway: transaction?.gateway,
        transactionStatus: transaction?.status,
        amountMatches: transaction
          ? Number(transaction.amount) === Number(order.total)
          : false,
        authorityMatches: transaction?.authority === authority,
      });

      return redirectTo("/profile?payment=verify-error");
    }

    // انصراف یا بازگشت ناموفق از درگاه
    if (gatewayStatus !== "NOK" && gatewayStatus !== "OK") {
      console.error("ZARINPAL_UNKNOWN_CALLBACK_STATUS", { orderId: order.id, gatewayStatus });
      return redirectTo("/profile?payment=verify-error");
    }

    // Status is an unauthenticated callback hint. Inquiry is authoritative for
    // the gateway state. Per the gateway guide, Verify is called only for Status=OK.
    const inquiry = await inquireAuthority({ authority });

    if (inquiry.state === "FAILED") {
      const result = await settleCanceledPayment({ order, authority });
      if (result === "PAID") {
        const latestOrder = await prisma.order.findUnique({
          where: { id: order.id },
          select: { stockReservationStatus: true, stockIssueAt: true },
        });
        return redirectTo(getPaidRedirectPath(latestOrder ?? {}));
      }
      if (result === "STOCK_ISSUE") return redirectTo("/profile?payment=paid-stock-issue");
      if (result === "CANCELED_STOCK_ISSUE") return redirectTo("/profile?payment=canceled-stock-issue");
      if (result !== "CANCELED") return redirectTo("/profile?payment=verify-error");
      await prisma.paymentAttempt.updateMany({ where: { authority, status: "PENDING" }, data: { status: "FAILED" } }).catch(() => {});
      return redirectTo("/profile?payment=canceled");
    }
    if (inquiry.state === "REVERSED") {
      await prisma.paymentAttempt.updateMany({
        where: { authority, status: "PENDING" },
        data: { status: "REVIEW", note: "ZarinPal Inquiry status REVERSED; manual financial review required" },
      });
      console.error("ZARINPAL_REVERSED_PAYMENT_REQUIRES_REVIEW", { orderId: order.id, authority });
      return redirectTo("/profile?payment=verify-error");
    }

    if (gatewayStatus === "NOK") {
      // Do not call Verify for NOK callbacks. If Inquiry did not say FAILED,
      // keep the reservation; the scheduled reconciler will inspect it again.
      return redirectTo("/profile?payment=canceled-pending");
    }

    if (inquiry.state !== "PAID" && inquiry.state !== "VERIFIED") {
      console.error("ZARINPAL_INQUIRY_NOT_PAID", {
        orderId: order.id,
        hint: gatewayStatus,
        inquiryStatus: inquiry.state,
        code: inquiry.code,
      });
      // IN_BANK, invalid Authority, network errors and unknown states keep the reservation.
      return redirectTo("/profile?payment=verify-error");
    }

    const verification = await verifyAuthority({ authority, total: order.total });
    if (verification.state !== "PAID") {
      console.error("ZARINPAL_VERIFY_NOT_CONFIRMED", {
        orderId: order.id,
        inquiryStatus: inquiry.state,
        verifyCode: verification.code,
      });
      return redirectTo("/profile?payment=verify-error");
    }

    const refId = verification.refId ?? transaction.refId ?? order.refId ?? null;
    const settlement = await settlePaidOrder({ order, authority, refId });
    return redirectTo(settlement === "STOCK_ISSUE" ? "/profile?payment=paid-stock-issue" : "/profile?payment=success");
  } catch (error) {
    console.error("ZARINPAL_VERIFY_ERROR", {
      orderId,
      message: error?.message,
      code: error?.code,
    });

    // بررسی Callback هم‌زمان احتمالی
    if (orderId !== null) {
      try {
        const latestOrder = await prisma.order.findUnique({
          where: { id: orderId },
          select: {
            paymentStatus: true,
            stockReservationStatus: true,
            stockIssueAt: true,
          },
        });

        if (latestOrder?.paymentStatus === "PAID") {
          return redirectTo(getPaidRedirectPath(latestOrder));
        }
      } catch (readError) {
        console.error(
          "ZARINPAL_ORDER_STATUS_CHECK_FAILED",
          readError,
        );
      }
    }

    return redirectTo("/profile?payment=verify-error");
  }
}
