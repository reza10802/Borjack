import { POST as sendOtp } from "../send-otp/route";

// Legacy alias: forwards to the single, hardened OTP flow (send-otp, purpose=RESET_PASSWORD).
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  return sendOtp(
    new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ phone: body?.phone, purpose: "RESET_PASSWORD" }),
    }),
  );
}
