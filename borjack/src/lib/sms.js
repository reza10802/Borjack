const KAVENEGAR_API_KEY = process.env.KAVENEGAR_API_KEY;
const KAVENEGAR_TEMPLATE = process.env.KAVENEGAR_TEMPLATE || "verify";

export async function sendOtpSms(phone, code) {
  const url = `https://api.kavenegar.com/v1/${KAVENEGAR_API_KEY}/verify/lookup.json`;
  const params = new URLSearchParams({
    receptor: phone,
    token: code,
    template: KAVENEGAR_TEMPLATE,
  });

  const res = await fetch(`${url}?${params.toString()}`, { method: "POST" });
  const data = await res.json();

  if (data?.return?.status !== 200) {
    throw new Error(
      data?.return?.message || `خطا در ارسال پیامک (${data?.return?.status})`,
    );
  }

  return data;
}