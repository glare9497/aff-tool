import { and, eq, inArray, lt, lte } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { accounts, posts, postTargets, type Account, type Post, type PostTarget } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { mimeOf, readMedia } from "@/lib/storage";
import { createIgContainer, igContainerStatus, publishIgContainer, publishToPage, type Media } from "./meta";
import { refreshTikTokToken, tiktokPublishStatus, uploadToInbox } from "./tiktok";

/**
 * Target lifecycle:
 *   scheduled → publishing → published                      (Facebook)
 *   scheduled → publishing → processing → published         (Instagram: container is processed first)
 *   scheduled → publishing → processing → inbox             (TikTok: video waits in the creator's drafts)
 *   any step → failed (retryable)
 * Accounts without a token get status "manual": the user posts and marks it done.
 */

const STUCK_AFTER_MS = 15 * 60 * 1000;
const PROCESSING_TIMEOUT_MS = 2 * 60 * 60 * 1000;

export type RunSummary = { started: number; advanced: number; failed: number };

export async function runDuePosts(): Promise<RunSummary> {
  await ensureSchema();
  const now = Date.now();
  const summary: RunSummary = { started: 0, advanced: 0, failed: 0 };

  // Recover targets left in "publishing" by a crashed run
  await db
    .update(postTargets)
    .set({ status: "failed", error: "Bị gián đoạn khi đang đăng. Bấm Thử lại.", updatedAt: now })
    .where(and(eq(postTargets.status, "publishing"), lt(postTargets.updatedAt, now - STUCK_AFTER_MS)));

  const due = await db
    .select({ id: postTargets.id })
    .from(postTargets)
    .where(and(eq(postTargets.status, "scheduled"), lte(postTargets.scheduledAt, now)));
  for (const { id } of due) {
    const ok = await startTarget(id);
    summary.started++;
    if (!ok) summary.failed++;
  }

  const processing = await db.select().from(postTargets).where(eq(postTargets.status, "processing"));
  for (const t of processing) {
    if (await advanceTarget(t)) summary.advanced++;
  }
  return summary;
}

/** Publishes one scheduled target now. Returns false when it failed. */
export async function startTarget(targetId: number) {
  // Claim it so concurrent runs (cron + local timer + "Đăng ngay") never double-post
  const [target] = await db
    .update(postTargets)
    .set({ status: "publishing", updatedAt: Date.now() })
    .where(and(eq(postTargets.id, targetId), inArray(postTargets.status, ["scheduled", "draft", "failed"])))
    .returning();
  if (!target) return true;

  try {
    const { account, post } = await loadContext(target);
    const media = await loadMedia(post);
    const token = await accountToken(account);

    if (account.platform === "facebook") {
      const res = await publishToPage({ pageId: account.externalId!, token, caption: target.caption, media, firstComment: target.firstComment });
      await finish(target.id, { status: "published", externalId: res.postId, permalink: res.permalink, publishedAt: Date.now() });
    } else if (account.platform === "instagram") {
      if (!media) throw new Error("Instagram bắt buộc có ảnh hoặc video.");
      const containerId = await createIgContainer({ igUserId: account.externalId!, token, caption: target.caption, media });
      await finish(target.id, { status: "processing", externalId: containerId });
    } else if (account.platform === "tiktok") {
      if (media?.type !== "video") throw new Error("TikTok chỉ nhận video.");
      const publishId = await uploadToInbox(token, media.data, media.mime);
      await finish(target.id, { status: "processing", externalId: publishId });
    } else {
      throw new Error(`Nền tảng không hỗ trợ: ${account.platform}`);
    }
    return true;
  } catch (e) {
    await fail(target, e);
    return false;
  }
}

/** Polls a target in "processing". Returns true when it moved to a final state. */
async function advanceTarget(target: PostTarget) {
  try {
    const { account } = await loadContext(target);
    const token = await accountToken(account);

    if (account.platform === "instagram") {
      const { status_code, status } = await igContainerStatus(target.externalId!, token);
      if (status_code === "FINISHED") {
        const res = await publishIgContainer(account.externalId!, token, target.externalId!);
        await finish(target.id, { status: "published", externalId: res.mediaId, permalink: res.permalink, publishedAt: Date.now() });
        return true;
      }
      if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`Instagram không xử lý được media: ${status ?? status_code}`);
    } else if (account.platform === "tiktok") {
      const res = await tiktokPublishStatus(token, target.externalId!);
      if (res.status === "SEND_TO_USER_INBOX" || res.status === "PUBLISH_COMPLETE") {
        await finish(target.id, { status: "inbox", publishedAt: Date.now() });
        return true;
      }
      if (res.status === "FAILED") throw new Error(`TikTok từ chối video: ${res.fail_reason ?? "không rõ lý do"}`);
    }

    if (Date.now() - target.updatedAt > PROCESSING_TIMEOUT_MS) throw new Error("Nền tảng xử lý quá lâu (hơn 2 giờ).");
    return false;
  } catch (e) {
    await fail(target, e);
    return true;
  }
}

async function loadContext(target: PostTarget) {
  const [account, post] = await Promise.all([
    db.query.accounts.findFirst({ where: eq(accounts.id, target.accountId) }),
    db.query.posts.findFirst({ where: eq(posts.id, target.postId) }),
  ]);
  if (!account) throw new Error("Tài khoản đã bị xoá.");
  if (!post) throw new Error("Bài đăng đã bị xoá.");
  if (!account.accessToken || !account.externalId) throw new Error("Tài khoản chưa kết nối API. Kết nối ở trang Tài khoản.");
  return { account, post };
}

async function loadMedia(post: Post): Promise<Media | null> {
  if (post.mediaType === "none" || !post.mediaKey) return null;
  return {
    type: post.mediaType as "image" | "video",
    data: await readMedia(post.mediaKey),
    mime: mimeOf(post.mediaKey),
    url: post.mediaUrl,
  };
}

/** Returns a usable access token, refreshing TikTok tokens shortly before they expire. */
async function accountToken(account: Account) {
  const token = decrypt(account.accessToken)!;
  if (account.platform !== "tiktok" || !account.tokenExpiresAt || account.tokenExpiresAt > Date.now() + 5 * 60 * 1000) return token;

  const refreshToken = decrypt(account.refreshToken);
  if (!refreshToken) throw new Error("TikTok hết hạn đăng nhập. Kết nối lại tài khoản.");
  const fresh = await refreshTikTokToken(refreshToken);
  await db
    .update(accounts)
    .set({
      accessToken: encrypt(fresh.access_token),
      refreshToken: encrypt(fresh.refresh_token),
      tokenExpiresAt: Date.now() + fresh.expires_in * 1000,
    })
    .where(eq(accounts.id, account.id));
  return fresh.access_token;
}

async function finish(id: number, values: Partial<PostTarget>) {
  await db
    .update(postTargets)
    .set({ ...values, error: null, updatedAt: Date.now() })
    .where(eq(postTargets.id, id));
}

async function fail(target: PostTarget, e: unknown) {
  await db
    .update(postTargets)
    .set({
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      attempts: target.attempts + 1,
      updatedAt: Date.now(),
    })
    .where(eq(postTargets.id, target.id));
}
