import { getBaseUrl } from "@/lib/base-url";
import { createOAuthState } from "@/lib/oauth-state";
import { hasMetaApp, metaAuthUrl } from "@/lib/social/meta";

export async function GET() {
  const base = await getBaseUrl();
  if (!hasMetaApp()) return Response.redirect(`${base}/accounts?error=meta_app`, 302);
  const state = await createOAuthState();
  return Response.redirect(metaAuthUrl(`${base}/api/connect/meta/callback`, state), 302);
}
