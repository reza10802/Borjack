import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getClientIp, ipBucketKey } from "@/lib/security";

// Same response whether the number is new or already registered (prevents account enumeration).
// The client then calls login(): a pre-existing verified account simply fails to log in with the
// new password and the user can use "forgot password".
const OK = { success: true };

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "اطلاعات نامعتبر است" }, { status: 400 });
    }
    const { name, phone, password } = parsed.data;

    const lim = await consumeRateLimit(`register:ip:${ipBucketKey(getClientIp(req.headers))}`, 10, 3600);
    if (!lim.allowed) {
      return NextResponse.json({ error: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید." },
        { status: 429, headers: { "Retry-After": String(lim.retryAfter) } });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true, isPhoneVerified: true } });

    if (!existing) {
      try {
        await prisma.user.create({ data: { name, phone, password: hashedPassword, role: "CUSTOMER" } });
      } catch (e) {
        if (e?.code !== "P2002") throw e; // lost a registration race → behave as "already exists"
      }
    } else if (!existing.isPhoneVerified) {
      // Never proven ownership of the number: latest registrant may (re)claim it, but still must pass OTP.
      await prisma.user.updateMany({
        where: { id: existing.id, isPhoneVerified: false },
        data: { name, password: hashedPassword, passwordChangedAt: new Date(), tokenVersion: { increment: 1 } },
      });
    }
    return NextResponse.json(OK, { status: 201 });
  } catch (error) {
    console.error("REGISTER_ERROR:", error?.name || "error");
    return NextResponse.json({ error: "خطا در ثبت‌نام" }, { status: 500 });
  }
}
