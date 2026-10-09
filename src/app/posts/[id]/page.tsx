import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts, links, posts, postTargets } from "@/db/schema";
import { CopyButton } from "@/components/copy-button";
import { StatusBadge } from "@/components/status-badge";
import { SOCIAL_PLATFORMS, fmtTime, type SocialPlatform } from "@/lib/format";
import { cancelTarget, deletePost, markPosted, publishNow, updateCaption } from "../actions";

// Always rendered per request: reads params and live data
export const instant = false;

const EDITABLE = ["draft", "scheduled", "manual", "failed"];

export default async function PostDetailPage({ params }: PageProps<"/posts/[id]">) {
  await connection();
  await ensureSchema();
  const id = Number((await params).id);
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!post) notFound();

  const [targets, accountRows, link] = await Promise.all([
    db.select().from(postTargets).where(eq(postTargets.postId, id)),
    db.select().from(accounts),
    post.linkId ? db.query.links.findFirst({ where: eq(links.id, post.linkId) }) : null,
  ]);
  const accountById = new Map(accountRows.map((a) => [a.id, a]));
  const mediaSrc = post.mediaUrl ?? (post.mediaKey ? `/media/${post.mediaKey}` : null);

  return (
    <div className="space-y-4">
      <Link href="/posts" className="text-sm text-muted hover:underline">
        ← Bài đăng
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">{post.title}</h1>
          <p className="text-sm text-muted">
            Tạo {fmtTime(post.createdAt)}
            {link && ` · Link: ${link.title}`}
          </p>
        </div>
        {mediaSrc &&
          (post.mediaType === "video" ? (
            <video src={mediaSrc} controls className="h-40 rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaSrc} alt="" className="h-40 rounded-lg" />
          ))}
      </div>

      {targets.map((t) => {
        const a = accountById.get(t.accountId);
        const canPublish = Boolean(a?.accessToken) && ["draft", "scheduled", "failed"].includes(t.status);
        const hidden = (
          <>
            <input type="hidden" name="targetId" value={t.id} />
            <input type="hidden" name="postId" value={post.id} />
          </>
        );
        return (
          <section key={t.id} className="card space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {a ? SOCIAL_PLATFORMS[a.platform as SocialPlatform]?.icon : "❔"} {a?.name ?? "(tài khoản đã xoá)"}
              </span>
              <StatusBadge status={t.status} />
              <span className="text-xs text-muted">
                {t.publishedAt ? `Đăng lúc ${fmtTime(t.publishedAt)}` : t.scheduledAt ? `Hẹn ${fmtTime(t.scheduledAt)}` : ""}
              </span>
              {t.permalink && (
                <a href={t.permalink} target="_blank" className="text-xs text-accent underline">
                  Xem bài
                </a>
              )}
              <div className="ml-auto flex gap-1">
                {canPublish && (
                  <form action={publishNow}>
                    {hidden}
                    <button className="btn-ghost">{t.status === "failed" ? "Thử lại" : "Đăng ngay"}</button>
                  </form>
                )}
                {EDITABLE.includes(t.status) && (
                  <form action={cancelTarget}>
                    {hidden}
                    <button className="btn-ghost">Huỷ</button>
                  </form>
                )}
              </div>
            </div>

            {t.error && <p className="text-sm text-red-600">⚠️ {t.error}</p>}
            {t.status === "inbox" && (
              <p className="text-sm text-amber-600">
                Video đã vào hộp nháp TikTok. Mở app TikTok → Hộp thư → bản nháp, gắn sản phẩm (giỏ hàng), dán caption rồi đăng. Xong thì dán link bài bên dưới.
              </p>
            )}
            {t.status === "manual" && (
              <p className="text-sm text-amber-600">
                Tài khoản chưa kết nối API. Đến giờ ({fmtTime(t.scheduledAt)}) hãy đăng tay với caption dưới đây, rồi dán link bài.
              </p>
            )}

            {EDITABLE.includes(t.status) ? (
              <form action={updateCaption} className="space-y-2">
                {hidden}
                <textarea name="caption" defaultValue={t.caption} rows={4} className="input" />
                {a?.platform === "facebook" && (
                  <input name="firstComment" defaultValue={t.firstComment ?? ""} className="input" placeholder="Bình luận đầu tiên (tuỳ chọn)" />
                )}
                <div className="flex gap-2">
                  <button className="btn-ghost">Lưu caption</button>
                  <CopyButton text={t.caption} label="Copy caption" />
                </div>
              </form>
            ) : (
              <div className="space-y-1">
                <p className="whitespace-pre-line text-sm">{t.caption}</p>
                {t.firstComment && <p className="text-xs text-muted">💬 {t.firstComment}</p>}
                <CopyButton text={t.caption} label="Copy caption" />
              </div>
            )}

            {["manual", "inbox", "failed"].includes(t.status) && (
              <form action={markPosted} className="flex gap-2">
                {hidden}
                <input name="permalink" className="input" placeholder="Link bài đã đăng (tuỳ chọn)" />
                <button className="btn-ghost whitespace-nowrap">✓ Đánh dấu đã đăng</button>
              </form>
            )}
          </section>
        );
      })}

      <form action={deletePost}>
        <input type="hidden" name="postId" value={post.id} />
        <button className="btn-ghost text-red-600">Xoá bài đăng</button>
      </form>
    </div>
  );
}
