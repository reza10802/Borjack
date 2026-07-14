import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set in environment variables");
}

export const ROLES = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  CUSTOMER: "CUSTOMER",
};

export const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "READY_TO_SHIP",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();

    const token =
      cookieStore.get("token")?.value ||
      cookieStore.get("accessToken")?.value ||
      cookieStore.get("auth-token")?.value;

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) return null;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        isActive: true,
        isPhoneVerified: true,

        addresses: {
          where: {
            isDefault: true,
          },
          take: 1,
        },
      },
    });

    if (!user) return null;
    if (!user.isActive) return null;

    const defaultAddress = user.addresses[0] || null;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      isPhoneVerified: user.isPhoneVerified,

      address: defaultAddress?.address ?? null,
      postalCode: defaultAddress?.postalCode ?? null,
      provinceName: defaultAddress?.provinceName ?? null,
      cityName: defaultAddress?.cityName ?? null,
      receiverName: defaultAddress?.receiverName ?? null,
      receiverPhone: defaultAddress?.receiverPhone ?? null,
    };
  } catch (err) {
    console.error("AUTH ERROR:", err);
    return null;
  }
}

export async function requireAuth() {
  const user = await getSessionUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "ابتدا وارد حساب شوید" },
        { status: 401 },
      ),
    };
  }

  return { user };
}

export async function requireVerifiedUser() {
  const auth = await requireAuth();
  if (auth.error) return auth;

  if (!auth.user.isPhoneVerified) {
    return {
      error: NextResponse.json(
        { error: "شماره موبایل هنوز تایید نشده است" },
        { status: 403 },
      ),
    };
  }

  return { user: auth.user };
}

export async function requireRoles(allowedRoles = []) {
  const auth = await requireAuth();
  if (auth.error) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      error: NextResponse.json({ error: "دسترسی غیرمجاز" }, { status: 403 }),
    };
  }

  return { user: auth.user };
}

export async function requireAdmin() {
  return requireRoles([ROLES.ADMIN]);
}

export async function requireManagerOrAdmin() {
  return requireRoles([ROLES.ADMIN, ROLES.MANAGER]);
}

export function canManagerChangeOrderStatus(from, to) {
  const transitions = {
    PENDING: ["PROCESSING"],
    PROCESSING: ["READY_TO_SHIP"],
    READY_TO_SHIP: ["SHIPPED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  return transitions[from]?.includes(to) ?? false;
}

export async function logAction({
  userId,
  action,
  entityType,
  entityId,
  description,
  oldValue = null,
  newValue = null,
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId: entityId ? String(entityId) : "",
        description,
        oldValue,
        newValue,
      },
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
}
