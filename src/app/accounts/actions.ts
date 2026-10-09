"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, ensureSchema } from "@/db";
import { accounts, postTargets } from "@/db/schema";
import { SOCIAL_PLATFORMS } from "@/lib/format";

export async function addAccount(formData: FormData) {
  await ensureSchema();
  const platform = String(formData.get("platform"));
  const name = String(formData.get("name") ?? "").trim();
  if (!(platform in SOCIAL_PLATFORMS) || !name) return;
  await db.insert(accounts).values({
    platform,
    name,
    handle: String(formData.get("handle") ?? "").trim() || null,
    niche: String(formData.get("niche") ?? "").trim() || null,
    createdAt: Date.now(),
  });
  revalidatePath("/accounts");
}

export async function updateAccount(formData: FormData) {
  await db
    .update(accounts)
    .set({
      niche: String(formData.get("niche") ?? "").trim() || null,
      note: String(formData.get("note") ?? "").trim() || null,
    })
    .where(eq(accounts.id, Number(formData.get("id"))));
  revalidatePath("/accounts");
}

export async function toggleAccount(formData: FormData) {
  const id = Number(formData.get("id"));
  const account = await db.query.accounts.findFirst({ where: eq(accounts.id, id) });
  if (account) await db.update(accounts).set({ active: !account.active }).where(eq(accounts.id, id));
  revalidatePath("/accounts");
}

export async function deleteAccount(formData: FormData) {
  const id = Number(formData.get("id"));
  // Pending posts to this account can no longer go out; published history is kept
  await db
    .update(postTargets)
    .set({ status: "cancelled", error: "Tài khoản đã bị xoá", updatedAt: Date.now() })
    .where(and(eq(postTargets.accountId, id), inArray(postTargets.status, ["draft", "scheduled", "manual", "failed"])));
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/accounts");
}
