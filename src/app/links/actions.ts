"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, ensureSchema } from "@/db";
import { clicks, links } from "@/db/schema";
import { CHANNELS } from "@/lib/format";
import { generateShopeeShortLink, hasShopeeApi } from "@/lib/shopee";

export type FormState = { ok?: string; error?: string };

const SLUG_RE = /^[a-z0-9]{3,40}$/;

function detectPlatform(url: string) {
  const host = new URL(url).hostname;
  if (host.includes("shopee")) return "shopee";
  if (host.includes("tiktok")) return "tiktok";
  return "other";
}

function randomSlug(channel: string) {
  return channel.slice(0, 2) + randomBytes(4).toString("hex").slice(0, 6);
}

async function resolveAffiliateUrl(originUrl: string, affiliateUrl: string, channel: string, slug: string) {
  if (affiliateUrl) return affiliateUrl;
  if (detectPlatform(originUrl) === "shopee" && hasShopeeApi()) {
    // sub_id1 = channel, sub_id2 = slug → lets imported orders be matched back to this link
    return generateShopeeShortLink(originUrl, [channel, slug]);
  }
  // No API: treat the pasted URL as an affiliate link generated manually in the Shopee portal
  return originUrl;
}

async function insertLink(input: { originUrl: string; affiliateUrl: string; title: string; channel: string; slug: string; note?: string }) {
  try {
    new URL(input.originUrl);
  } catch {
    throw new Error(`URL không hợp lệ: ${input.originUrl}`);
  }
  if (!SLUG_RE.test(input.slug)) throw new Error(`Slug "${input.slug}" chỉ được dùng a-z, 0-9 (3–40 ký tự)`);
  const existing = await db.query.links.findFirst({ where: eq(links.slug, input.slug) });
  if (existing) throw new Error(`Slug "${input.slug}" đã tồn tại`);

  const affiliateUrl = await resolveAffiliateUrl(input.originUrl, input.affiliateUrl, input.channel, input.slug);
  await db.insert(links).values({
    slug: input.slug,
    title: input.title || input.slug,
    platform: detectPlatform(input.originUrl),
    channel: input.channel,
    originUrl: input.originUrl,
    affiliateUrl,
    note: input.note || null,
    createdAt: Date.now(),
  });
}

function readChannel(formData: FormData) {
  const channel = String(formData.get("channel") ?? "other");
  return (CHANNELS as readonly string[]).includes(channel) ? channel : "other";
}

export async function createLink(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureSchema();
  const channel = readChannel(formData);
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase() || randomSlug(channel);
  try {
    await insertLink({
      originUrl: String(formData.get("originUrl") ?? "").trim(),
      affiliateUrl: String(formData.get("affiliateUrl") ?? "").trim(),
      title: String(formData.get("title") ?? "").trim(),
      note: String(formData.get("note") ?? "").trim(),
      channel,
      slug,
    });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/links");
  return { ok: `Đã tạo link /go/${slug}` };
}

/** One product per line: `url` or `url | tiêu đề`. */
export async function bulkCreateLinks(_prev: FormState, formData: FormData): Promise<FormState> {
  await ensureSchema();
  const channel = readChannel(formData);
  const lines = String(formData.get("lines") ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let created = 0;
  const errors: string[] = [];
  for (const line of lines) {
    const [url, title = ""] = line.split("|").map((s) => s.trim());
    try {
      await insertLink({ originUrl: url, affiliateUrl: "", title, channel, slug: randomSlug(channel) });
      created++;
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  revalidatePath("/links");
  return {
    ok: created ? `Đã tạo ${created}/${lines.length} link` : undefined,
    error: errors.length ? errors.join("\n") : undefined,
  };
}

export async function deleteLink(formData: FormData) {
  const id = Number(formData.get("id"));
  await db.delete(clicks).where(eq(clicks.linkId, id));
  await db.delete(links).where(eq(links.id, id));
  revalidatePath("/links");
}
