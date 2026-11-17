import jwt from "jsonwebtoken";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set in environment variables");
  return s;
}
export const SESSION_COOKIE = "token";
const SESSION_TTL_USER = "7d";
const SESSION_TTL_STAFF = "8h"; // shorter life bounds stale role claims used by the page gate

export function signSessionToken(user) {
  const staff = user.role === "ADMIN" || user.role === "SUPPLIER";
  return jwt.sign(
    { id: user.id, phone: user.phone, role: user.role, isPhoneVerified: true, tv: user.tokenVersion ?? 0 },
    secret(),
    { algorithm: "HS256", expiresIn: staff ? SESSION_TTL_STAFF : SESSION_TTL_USER },
  );
}
export function sessionMaxAgeSeconds(user) {
  return user.role === "ADMIN" || user.role === "SUPPLIER" ? 8 * 3600 : 7 * 24 * 3600;
}
export function verifyJwt(token) {
  return jwt.verify(token, secret(), { algorithms: ["HS256"] });
}


const PASSWORD_RESET_TTL = "10m";

// A password-reset token is deliberately NOT a login session. It only authorizes
// one password change and is additionally backed by a one-time DB grant.
export function signPasswordResetToken(user, grantId) {
  return jwt.sign(
    {
      purpose: "PASSWORD_RESET",
      id: user.id,
      phone: user.phone,
      tv: user.tokenVersion ?? 0,
      jti: grantId,
    },
    secret(),
    { algorithm: "HS256", expiresIn: PASSWORD_RESET_TTL },
  );
}
