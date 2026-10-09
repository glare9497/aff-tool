import { sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { encrypt } from "@/lib/crypto";
import { checkOAuthState } from "@/lib/oauth-state";
import { exchangeTikTokCode, tiktokUserInfo } from "@/lib/social/tiktok";

export async function GET(request: Request) {
  const base = await getBaseUrl();
  const url = new URL(request.url);
  const fail = (msg: string) => Response.redirect(`${base}/accounts?error=${encodeURIComponent(msg)}`, 302);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") ?? "Bạn đã huỷ kết nối TikTok");
  if (!(await checkOAuthState(url.searchParams.get("state")))) return fail("Phiên kết nối hết hạn, thử lại");

  try {
    await ensureSchema();
    const tokens = await exchangeTikTokCode(url.searchParams.get("code") ?? "", `${base}/api/connect/tiktok/callback`);
    const user = await tiktokUserInfo(tokens.access_token);
    await db
      .insert(accounts)
      .values({
        platform: "tiktok",
        name: user.display_name,
        externalId: tokens.open_id,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
        createdAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: [accounts.platform, accounts.externalId],
        set: {
          name: sql`excluded.name`,
          accessToken: sql`excluded.access_token`,
          refreshToken: sql`excluded.refresh_token`,
          tokenExpiresAt: sql`excluded.token_expires_at`,
        },
      });
    return Response.redirect(`${base}/accounts?connected=1`, 302);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
