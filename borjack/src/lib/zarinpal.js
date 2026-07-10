const IS_SANDBOX = true;

export const ZARINPAL_REQUEST_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/request.json"
  : "https://payment.zarinpal.com/pg/v4/payment/request.json";

export const ZARINPAL_VERIFY_URL = IS_SANDBOX
  ? "https://sandbox.zarinpal.com/pg/v4/payment/verify.json"
  : "https://payment.zarinpal.com/pg/v4/payment/verify.json";

export function getZarinpalStartPayUrl(authority) {
  return IS_SANDBOX
    ? `https://sandbox.zarinpal.com/pg/StartPay/${authority}`
    : `https://payment.zarinpal.com/pg/StartPay/${authority}`;
}