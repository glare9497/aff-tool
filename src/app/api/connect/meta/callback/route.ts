import { sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { encrypt } from "@/lib/crypto";
import { checkOAuthState } from "@/lib/oauth-state";
import { exchangeMetaCode, listPages } from "@/lib/social/meta";

/** Imports every Page the user manages, plus the Instagram account linked to each. */
export async function GET(request: Request) {
  const base = await getBaseUrl();
  const url = new URL(request.url);
  const fail = (msg: string) => Response.redirect(`${base}/accounts?error=${encodeURIComponent(msg)}`, 302);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") ?? "Bạn đã huỷ kết nối Facebook");
  if (!(await checkOAuthState(url.searchParams.get("state")))) return fail("Phiên kết nối hết hạn, thử lại");

  try {
    await ensureSchema();
    const userToken = await exchangeMetaCode(url.searchParams.get("code") ?? "", `${base}/api/connect/meta/callback`);
    const pages = await listPages(userToken);
    const rows = pages.flatMap((p) => {
      const accessToken = encrypt(p.access_token);
      const page = { platform: "facebook", name: p.name, handle: null as string | null, externalId: p.id, accessToken };
      const ig = p.instagram_business_account;
      if (!ig) return [page];
      const igName = ig.name || ig.username || `Instagram của ${p.name}`;
      return [page, { platform: "instagram", name: igName, handle: ig.username ?? null, externalId: ig.id, accessToken }];
    });

    for (const r of rows) {
      await db
        .insert(accounts)
        .values({ ...r, createdAt: Date.now() })
        .onConflictDoUpdate({
          target: [accounts.platform, accounts.externalId],
          set: { name: sql`excluded.name`, handle: sql`excluded.handle`, accessToken: sql`excluded.access_token` },
        });
    }
    return Response.redirect(`${base}/accounts?connected=${rows.length}`, 302);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}
