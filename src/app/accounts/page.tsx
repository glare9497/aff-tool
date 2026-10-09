import { connection } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts, postTargets } from "@/db/schema";
import { getBaseUrl } from "@/lib/base-url";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/format";
import { hasMetaApp } from "@/lib/social/meta";
import { hasTikTokApp } from "@/lib/social/tiktok";
import { addAccount, deleteAccount, toggleAccount, updateAccount } from "./actions";

// Always rendered per request: reads search params and live data
export const instant = false;

const ERRORS: Record<string, string> = {
  meta_app: "Chưa cấu hình META_APP_ID / META_APP_SECRET trong .env.local (xem SOCIAL.md).",
  tiktok_app: "Chưa cấu hình TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET trong .env.local (xem SOCIAL.md).",
};

export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  await connection();
  await ensureSchema();
  const { connected, error } = await searchParams;
  const base = await getBaseUrl();
  const rows = await db
    .select({
      account: accounts,
      posted: sql<number>`count(CASE WHEN ${postTargets.status} IN ('published','inbox') THEN 1 END)`,
      pending: sql<number>`count(CASE WHEN ${postTargets.status} IN ('scheduled','processing','manual') THEN 1 END)`,
    })
    .from(accounts)
    .leftJoin(postTargets, eq(postTargets.accountId, accounts.id))
    .groupBy(accounts.id)
    .orderBy(asc(accounts.platform), asc(accounts.name));

  const apiStatus = (a: typeof accounts.$inferSelect) =>
    a.accessToken ? { text: "Đã kết nối API", cls: "text-green-600" } : { text: "Thủ công", cls: "text-muted" };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Tài khoản mạng xã hội</h1>

      {connected && <p className="card text-sm text-green-600">✅ Đã kết nối / cập nhật {String(connected)} tài khoản.</p>}
      {error && <p className="card text-sm text-red-600">{ERRORS[String(error)] ?? String(error)}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2">
          <h2 className="font-medium">📘 Facebook Page + 📸 Instagram</h2>
          <p className="text-sm text-muted">
            Đăng nhập Facebook một lần, tool tự nhập mọi Page bạn quản lý và tài khoản Instagram Business/Creator liên kết với từng Page.
          </p>
          <a href="/api/connect/meta" className={`btn inline-block ${hasMetaApp() ? "" : "pointer-events-none opacity-50"}`}>
            Kết nối Facebook
          </a>
          {!hasMetaApp() && <p className="text-xs text-amber-600">Cần tạo Meta App trước: xem SOCIAL.md</p>}
          <p className="text-xs text-muted">Redirect URI cần khai báo trong Meta App: {base}/api/connect/meta/callback</p>
        </div>
        <div className="card space-y-2">
          <h2 className="font-medium">🎵 TikTok</h2>
          <p className="text-sm text-muted">
            Video được gửi vào <b>hộp nháp TikTok</b>; bạn mở app, gắn sản phẩm vào giỏ hàng rồi bấm đăng.
          </p>
          <a href="/api/connect/tiktok" className={`btn inline-block ${hasTikTokApp() ? "" : "pointer-events-none opacity-50"}`}>
            Kết nối TikTok
          </a>
          {!hasTikTokApp() && <p className="text-xs text-amber-600">Cần tạo TikTok Developer App trước: xem SOCIAL.md</p>}
          <p className="text-xs text-muted">Redirect URI cần khai báo trong TikTok App: {base}/api/connect/tiktok/callback</p>
        </div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-medium">Danh sách tài khoản</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Trạng thái API</th>
              <th>Ngách / ghi chú</th>
              <th className="num">Đã đăng</th>
              <th className="num">Đang chờ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ account: a, posted, pending }) => {
              const status = apiStatus(a);
              return (
                <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                  <td>
                    <div className="font-medium">
                      {SOCIAL_PLATFORMS[a.platform as SocialPlatform]?.icon} {a.name}
                    </div>
                    <div className="text-xs text-muted">
                      {SOCIAL_PLATFORMS[a.platform as SocialPlatform]?.label}
                      {a.handle && ` · @${a.handle}`}
                      {!a.active && " · Tạm dừng"}
                    </div>
                  </td>
                  <td className={`text-xs ${status.cls}`}>{status.text}</td>
                  <td>
                    <form action={updateAccount} className="flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <input name="niche" defaultValue={a.niche ?? ""} placeholder="Ngách" className="input w-32" />
                      <input name="note" defaultValue={a.note ?? ""} placeholder="Ghi chú" className="input w-40" />
                      <button className="btn-ghost">Lưu</button>
                    </form>
                  </td>
                  <td className="num">{posted}</td>
                  <td className="num">{pending}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <form action={toggleAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn-ghost">{a.active ? "Tạm dừng" : "Bật lại"}</button>
                      </form>
                      <form action={deleteAccount}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="btn-ghost text-red-600">Xoá</button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  Chưa có tài khoản. Kết nối ở trên, hoặc thêm thủ công ở dưới.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2 className="mb-1 font-medium">Thêm tài khoản thủ công</h2>
        <p className="mb-3 text-xs text-muted">
          Cho tài khoản chưa kết nối API: tool vẫn lên lịch và nhắc bạn đăng, bạn đăng tay rồi bấm &quot;Đánh dấu đã đăng&quot;.
        </p>
        <form action={addAccount} className="grid gap-2 md:grid-cols-5">
          <select name="platform" className="input" defaultValue="tiktok">
            {Object.entries(SOCIAL_PLATFORMS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
          <input name="name" className="input" placeholder="Tên hiển thị *" required />
          <input name="handle" className="input" placeholder="@username" />
          <input name="niche" className="input" placeholder="Ngách (gia dụng, mẹ bé...)" />
          <button className="btn">Thêm</button>
        </form>
      </section>
    </div>
  );
}
