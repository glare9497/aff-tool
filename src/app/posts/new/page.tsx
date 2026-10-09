import { desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { db, ensureSchema } from "@/db";
import { accounts, links, scripts } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import type { VideoScript } from "@/lib/script-ai";
import { hasR2 } from "@/lib/storage";
import { PostForm } from "./post-form";

// Always rendered per request: reads live data
export const instant = false;

export default async function NewPostPage() {
  await connection();
  await ensureSchema();
  const base = await getBaseUrl();
  const [accountRows, linkRows, scriptRows] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.active, true)).orderBy(accounts.platform, accounts.name),
    db.select().from(links).orderBy(desc(links.createdAt)),
    db.select().from(scripts).orderBy(desc(scripts.createdAt)).limit(50),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tạo bài đăng</h1>
      <PostForm
        accounts={accountRows.map((a) => ({ id: a.id, platform: a.platform, name: a.name, niche: a.niche, connected: Boolean(a.accessToken) }))}
        links={linkRows.map((l) => ({ id: l.id, title: l.title, url: `${base}/go/${l.slug}` }))}
        scripts={scriptRows.map((s) => {
          const out = JSON.parse(s.output) as VideoScript;
          const tags = out.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
          return { id: s.id, productName: s.productName, caption: `${out.caption}\n\n${tags}` };
        })}
        hasR2={hasR2()}
        hasAiKey={Boolean(process.env.ANTHROPIC_API_KEY)}
      />
    </div>
  );
}
