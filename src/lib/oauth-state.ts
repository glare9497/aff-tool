import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "oauth_state";

/** CSRF protection for OAuth: a random state kept in a short-lived cookie. */
export async function createOAuthState() {
  const state = randomBytes(16).toString("hex");
  (await cookies()).set(COOKIE, state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  return state;
}

export async function checkOAuthState(state: string | null) {
  const jar = await cookies();
  const expected = jar.get(COOKIE)?.value;
  jar.delete(COOKIE);
  return Boolean(state && expected && state === expected);
}
