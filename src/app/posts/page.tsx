import Link from "next/link";
import { connection } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts, posts, postTargets } from "@/db/schema";
import { StatusBadge, TARGET_STATUS } from "@/components/status-badge";
import { SOCIAL_PLATFORMS, fmtTime, type SocialPlatform } from "@/lib/format";

// Always rendered per request: reads search params and live data
export const instant = false;

const FILTERS = [
  { key: "", label: "Tất cả" },
  { key: "todo", label: "Cần xử lý" },
  { key: "scheduled", label: "Đã hẹn giờ" },
  { key: "published", label: "Đã đăng" },
  { key: "failed", label: "Lỗi" },
];
const TODO = ["manual", "inbox", "failed"];

export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  await connection();
  await ensureSchema();
  const filter = String((await searchParams).filter ?? "");

  const postRows = await db.select().from(posts).orderBy(desc(posts.createdAt)).limit(100);
  const targets = postRows.length
    ? await db.select().from(postTargets).where(inArray(postTargets.postId, postRows.map((p) => p.id)))
    : [];
  const accountRows = await db.select().from(accounts);
  const accountById = new Map(accountRows.map((a) => [a.id, a]));

  const matches = (status: string) =>
    !filter || (filter === "todo" ? TODO.includes(status) : filter === "scheduled" ? ["scheduled", "processing"].includes(status) : status === filter);
  const visible = postRows
    .map((p) => ({ post: p, targets: targets.filter((t) => t.postId === p.id) }))
    .filter((x) => x.targets.some((t) => matches(t.status)) || (!filter && x.targets.length === 0));
  const todoCount = targets.filter((t) => TODO.includes(t.status)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Bài đăng</h1>
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key ? `/posts?filter=${f.key}` : "/posts"} className={`btn-ghost ${filter === f.key ? "border-accent text-accent" : ""}`}>
            {f.label}
            {f.key === "todo" && todoCount > 0 && <span className="ml-1 rounded bg-accent px-1.5 text-xs text-white">{todoCount}</span>}
          </Link>
        ))}
        <Link href="/posts/new" className="btn">
          + Tạo bài đăng
        </Link>
      </div>

      {visible.map(({ post, targets }) => (
        <Link key={post.id} href={`/posts/${post.id}`} className="card block hover:border-accent">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-medium">{post.title}</span>
            <span className="text-xs text-muted">
              {post.mediaType === "video" ? "🎬 video" : post.mediaType === "image" ? "🖼 ảnh" : "📝 chữ"} · tạo {fmtTime(post.createdAt)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {targets.map((t) => {
              const a = accountById.get(t.accountId);
              return (
                <span key={t.id} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs">
                  {a ? SOCIAL_PLATFORMS[a.platform as SocialPlatform]?.icon : "❔"} {a?.name ?? "(đã xoá)"}
                  <StatusBadge status={t.status} />
                  {t.status === "scheduled" && <span className="text-muted">{fmtTime(t.scheduledAt)}</span>}
                </span>
              );
            })}
          </div>
        </Link>
      ))}
      {visible.length === 0 && (
        <p className="card py-8 text-center text-sm text-muted">
          {filter ? `Không có bài nào ở trạng thái "${FILTERS.find((f) => f.key === filter)?.label ?? TARGET_STATUS[filter]?.label}".` : "Chưa có bài đăng nào."}
        </p>
      )}
    </div>
  );
}
