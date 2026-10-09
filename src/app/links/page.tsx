import { connection } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { clicks, links } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { fmtNum } from "@/lib/format";
import { hasShopeeAffiliateId, hasShopeeApi } from "@/lib/shopee";
import { deleteLink } from "./actions";
import { CopyButton } from "@/components/copy-button";
import { LinkForms, type ShopeeLinkMode } from "./forms";

// Always rendered per request: reads cookies, search params and live data
export const instant = false;

export default async function LinksPage() {
  await connection();
  await ensureSchema();
  const base = await getBaseUrl();
  const shopeeMode: ShopeeLinkMode = hasShopeeApi() ? "api" : hasShopeeAffiliateId() ? "affiliateId" : "manual";
  const rows = await db
    .select({ link: links, clicks: sql<number>`count(${clicks.id})` })
    .from(links)
    .leftJoin(clicks, eq(clicks.linkId, links.id))
    .groupBy(links.id)
    .orderBy(desc(links.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Quản lý link</h1>
      <LinkForms shopeeMode={shopeeMode} />

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>Short link</th>
              <th>Kênh</th>
              <th className="num">Clicks</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ link, clicks }) => {
              const shortUrl = `${base}/go/${link.slug}`;
              return (
                <tr key={link.id}>
                  <td>
                    <div className="font-medium">{link.title}</div>
                    <a
                      href={link.affiliateUrl}
                      target="_blank"
                      className="block max-w-xs truncate text-xs text-muted hover:underline"
                    >
                      {link.affiliateUrl}
                    </a>
                    {link.note && <div className="text-xs text-muted">📝 {link.note}</div>}
                  </td>
                  <td className="font-mono text-xs">{shortUrl}</td>
                  <td>{link.channel}</td>
                  <td className="num">{fmtNum(clicks)}</td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <CopyButton text={shortUrl} />
                      <form action={deleteLink}>
                        <input type="hidden" name="id" value={link.id} />
                        <button className="btn-ghost text-red-600">Xoá</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted">
                  Chưa có link nào. Tạo link đầu tiên ở trên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
