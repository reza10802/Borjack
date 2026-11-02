const IS_SANDBOX =
  process.env.ZARINPAL_SANDBOX?.trim().toLowerCase() === "true";

const API_BASE_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com"
  : "https://payment.zarinpal.com";

const START_PAY_BASE_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/StartPay"
  : "https://www.zarinpal.com/pg/StartPay";

export const ZARINPAL_GATEWAY_NAME = IS_SANDBOX
  ? "ZARINPAL_SANDBOX"
  : "ZARINPAL_PRODUCTION";

export const ZARINPAL_REQUEST_URL =
  `${API_BASE_URL}/pg/v4/payment/request.json`;

export const ZARINPAL_VERIFY_URL =
  `${API_BASE_URL}/pg/v4/payment/verify.json`;

export function getZarinpalStartPayUrl(authority) {
  if (typeof authority !== "string" || !authority.trim()) {
    throw new Error("ZarinPal authority is required");
  }

  return `${START_PAY_BASE_URL}/${encodeURIComponent(authority)}`;
}

// Borjak stores product/order prices in Toman; ZarinPal API expects Rial.
export function toZarinpalAmount(amountInToman) {
  const amount = Number(amountInToman);

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Invalid payment amount");
  }

  const amountInRial = amount * 10;

  if (!Number.isSafeInteger(amountInRial)) {
    throw new Error("Payment amount is too large");
  }

  return amountInRial;
}

export { IS_SANDBOX as ZARINPAL_IS_SANDBOX };
