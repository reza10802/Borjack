import { maskPhone } from "@/lib/security";

export class SmsError extends Error {
  constructor(code, detail) {
    super(code); // never put provider text/keys in message
    this.name = "SmsError";
    this.code = code;
    this.detail = detail; // internal only; never returned to clients
  }
}

export async function sendOtpSms(phone, code, purpose) {
  const apiKey = process.env.SMS_IR_API_KEY;
  if (!apiKey) throw new SmsError("SMS_NOT_CONFIGURED");

  const templateId =
    purpose === "VERIFY_PHONE" ? process.env.SMS_IR_VERIFY_TEMPLATE_ID
    : purpose === "RESET_PASSWORD" ? process.env.SMS_IR_RESET_PASSWORD_TEMPLATE_ID
    : purpose === "LOGIN" ? (process.env.SMS_IR_LOGIN_TEMPLATE_ID || process.env.SMS_IR_VERIFY_TEMPLATE_ID)
    : null;
  if (!templateId) throw new SmsError("SMS_TEMPLATE_MISSING");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.sms.ir/v1/send/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ mobile: phone, templateId: Number(templateId), parameters: [{ name: "Code", value: code }] }),
      signal: controller.signal,
    });
    if (!res.ok) {
      // log only status + masked phone (no body, no code, no key)
      console.error("SMS_IR_FAILED", { status: res.status, purpose, phone: maskPhone(phone) });
      throw new SmsError("SMS_PROVIDER_ERROR", `status ${res.status}`);
    }
    return true;
  } catch (e) {
    if (e instanceof SmsError) throw e;
    console.error("SMS_IR_NETWORK_ERROR", { purpose, phone: maskPhone(phone), name: e?.name });
    throw new SmsError("SMS_NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}
