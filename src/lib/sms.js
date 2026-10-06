const SMS_IR_API_KEY = process.env.SMS_IR_API_KEY;

const SMS_IR_VERIFY_TEMPLATE_ID =
  process.env.SMS_IR_VERIFY_TEMPLATE_ID;

const SMS_IR_RESET_PASSWORD_TEMPLATE_ID =
  process.env.SMS_IR_RESET_PASSWORD_TEMPLATE_ID;

export async function sendOtpSms(phone, code, purpose) {
  if (!SMS_IR_API_KEY) {
    throw new Error("SMS_IR_API_KEY تنظیم نشده است");
  }

  let templateId;

  switch (purpose) {
    case "VERIFY_PHONE":
      templateId = SMS_IR_VERIFY_TEMPLATE_ID;
      break;

    case "RESET_PASSWORD":
      templateId = SMS_IR_RESET_PASSWORD_TEMPLATE_ID;
      break;

    default:
      throw new Error("نوع OTP نامعتبر است");
  }

  if (!templateId) {
    throw new Error(`Template ID برای ${purpose} تنظیم نشده است`);
  }

  const payload = {
    mobile: phone,
    templateId: Number(templateId),
    parameters: [
      {
        name: "Code",
        value: code,
      },
    ],
  };

  console.log("SMS.IR REQUEST:", {
    mobile: phone,
    templateId: Number(templateId),
    purpose,
  });

  const res = await fetch("https://api.sms.ir/v1/send/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": SMS_IR_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = { raw };
  }

  console.log("SMS.IR RESPONSE:", {
    status: res.status,
    ok: res.ok,
    data,
  });

  if (!res.ok) {
    throw new Error(
      data?.message ||
        data?.errors?.[0]?.message ||
        data?.raw ||
        `خطا در ارسال پیامک (${res.status})`
    );
  }

  return data;
}