"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, ensureSchema } from "@/db";
import { accounts, posts, postTargets, scripts } from "@/db/schema";
import { generateCaptions } from "@/lib/caption-ai";
import { describeAiError, type VideoScript } from "@/lib/script-ai";
import { runDuePosts, startTarget } from "@/lib/social/publisher";
import { deleteMedia } from "@/lib/storage";

// ---------- AI captions ----------

export type CaptionRequest = { productName: string; productInfo: string; scriptId: number | null; accountIds: number[] };
export type CaptionResult = { error?: string; captions?: { accountId: number; caption: string }[] };

export async function aiCaptions(req: CaptionRequest): Promise<CaptionResult> {
  await ensureSchema();
  if (!req.productName.trim()) return { error: "Nhập tên bài / sản phẩm trước" };
  if (req.accountIds.length === 0) return { error: "Chọn ít nhất 1 tài khoản" };

  const selected = await db.select().from(accounts).where(inArray(accounts.id, req.accountIds));
  let scriptSummary: string | null = null;
  if (req.scriptId) {
    const s = await db.query.scripts.findFirst({ where: eq(scripts.id, req.scriptId) });
    if (s) {
      const out = JSON.parse(s.output) as VideoScript;
      scriptSummary = `Góc tiếp cận: ${out.angle}\nHook: ${out.hooks.map((h) => h.text).join(" / ")}\nCaption gốc: ${out.caption}`;
    }
  }
  try {
    const captions = await generateCaptions({
      productName: req.productName,
      productInfo: req.productInfo,
      scriptSummary,
      accounts: selected.map((a) => ({ id: a.id, platform: a.platform, name: a.name, niche: a.niche })),
    });
    return { captions };
  } catch (e) {
    return { error: describeAiError(e) };
  }
}

// ---------- Create ----------

export type NewPost = {
  title: string;
  linkId: number | null;
  scriptId: number | null;
  media: { type: "image" | "video"; key: string; url: string | null; size: number } | null;
  targets: { accountId: number; caption: string; firstComment: string }[];
  mode: "now" | "schedule" | "draft";
  scheduledAt: number | null; // ms, computed in the browser from local time
  staggerMinutes: number;
};

export async function createPost(input: NewPost): Promise<{ error?: string }> {
  await ensureSchema();
  if (!input.title.trim()) return { error: "Nhập tên bài đăng" };
  if (input.targets.length === 0) return { error: "Chọn ít nhất 1 tài khoản" };
  if (input.mode === "schedule" && !input.scheduledAt) return { error: "Chọn thời gian đăng" };

  const targetAccounts = await db.select().from(accounts).where(inArray(accounts.id, input.targets.map((t) => t.accountId)));
  const byId = new Map(targetAccounts.map((a) => [a.id, a]));

  const problems: string[] = [];
  for (const t of input.targets) {
    const a = byId.get(t.accountId);
    if (!a) problems.push(`Tài khoản #${t.accountId} không tồn tại`);
    else if (!t.caption.trim()) problems.push(`${a.name}: chưa có caption`);
    else if (a.platform === "instagram" && !input.media) problems.push(`${a.name}: Instagram bắt buộc có ảnh/video`);
    else if (a.platform === "tiktok" && input.media?.type !== "video") problems.push(`${a.name}: TikTok bắt buộc có video`);
  }
  if (problems.length) return { error: problems.join("\n") };

  const now = Date.now();
  const [post] = await db
    .insert(posts)
    .values({
      title: input.title.trim(),
      linkId: input.linkId,
      scriptId: input.scriptId,
      mediaType: input.media?.type ?? "none",
      mediaKey: input.media?.key ?? null,
      mediaUrl: input.media?.url ?? null,
      mediaSize: input.media?.size ?? null,
      createdAt: now,
    })
    .returning({ id: posts.id });

  // Spread posts across accounts so many pages don't publish at the same second
  const start = input.mode === "schedule" ? input.scheduledAt! : now;
  const stagger = Math.max(0, input.staggerMinutes) * 60_000;
  await db.insert(postTargets).values(
    input.targets.map((t, i) => {
      const connected = Boolean(byId.get(t.accountId)?.accessToken);
      return {
        postId: post.id,
        accountId: t.accountId,
        caption: t.caption.trim(),
        firstComment: t.firstComment.trim() || null,
        status: input.mode === "draft" ? "draft" : connected ? "scheduled" : "manual",
        scheduledAt: input.mode === "draft" ? null : start + i * stagger,
        updatedAt: now,
      };
    }),
  );

  if (input.mode === "now") after(() => runDuePosts());
  revalidatePath("/posts");
  redirect(`/posts/${post.id}`);
}

// ---------- Per-target actions ----------

function refresh(formData: FormData) {
  revalidatePath(`/posts/${formData.get("postId")}`);
  revalidatePath("/posts");
}

export async function publishNow(formData: FormData) {
  await startTarget(Number(formData.get("targetId")));
  refresh(formData);
}

export async function cancelTarget(formData: FormData) {
  await db
    .update(postTargets)
    .set({ status: "cancelled", updatedAt: Date.now() })
    .where(and(eq(postTargets.id, Number(formData.get("targetId"))), inArray(postTargets.status, ["draft", "scheduled", "manual", "failed"])));
  refresh(formData);
}

export async function markPosted(formData: FormData) {
  await db
    .update(postTargets)
    .set({
      status: "published",
      permalink: String(formData.get("permalink") ?? "").trim() || null,
      publishedAt: Date.now(),
      error: null,
      updatedAt: Date.now(),
    })
    .where(eq(postTargets.id, Number(formData.get("targetId"))));
  refresh(formData);
}

export async function updateCaption(formData: FormData) {
  await db
    .update(postTargets)
    .set({
      caption: String(formData.get("caption") ?? ""),
      firstComment: String(formData.get("firstComment") ?? "").trim() || null,
      updatedAt: Date.now(),
    })
    .where(and(eq(postTargets.id, Number(formData.get("targetId"))), inArray(postTargets.status, ["draft", "scheduled", "manual", "failed"])));
  refresh(formData);
}

export async function deletePost(formData: FormData) {
  const id = Number(formData.get("postId"));
  const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (post?.mediaKey) await deleteMedia(post.mediaKey).catch(() => {});
  await db.delete(postTargets).where(eq(postTargets.postId, id));
  await db.delete(posts).where(eq(posts.id, id));
  revalidatePath("/posts");
  redirect("/posts");
}
