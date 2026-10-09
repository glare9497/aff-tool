import { getBaseUrl } from "@/lib/base-url";
import { createOAuthState } from "@/lib/oauth-state";
import { hasTikTokApp, tiktokAuthUrl } from "@/lib/social/tiktok";

export async function GET() {
  const base = await getBaseUrl();
  if (!hasTikTokApp()) return Response.redirect(`${base}/accounts?error=tiktok_app`, 302);
  const state = await createOAuthState();
  return Response.redirect(tiktokAuthUrl(`${base}/api/connect/tiktok/callback`, state), 302);
}
