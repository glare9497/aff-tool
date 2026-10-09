import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "aff_session";

function sessionToken() {
  const secret = process.env.AUTH_SECRET ?? "dev-secret-change-me";
  return createHmac("sha256", secret).update(process.env.ADMIN_PASSWORD ?? "").digest("hex");
}

export function isValidSession(value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(sessionToken());
  const actual = Buffer.from(value);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function checkPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export { sessionToken };
