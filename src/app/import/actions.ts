"use server";

import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, ensureSchema } from "@/db";
import { links, orders } from "@/db/schema";
import { PLATFORMS } from "@/lib/format";
import { parseReport } from "@/lib/report";

export type ImportState = {
  error?: string;
  imported?: number;
  matched?: number;
  skipped?: number;
  mapping?: Record<string, string | null>;
  headers?: string[];
};

export async function importReport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  await ensureSchema();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn file CSV" };
  const platformInput = String(formData.get("platform") ?? "shopee");
  const platform = (PLATFORMS as readonly string[]).includes(platformInput) ? platformInput : "other";

  const { orders: parsed, mapping, headers, skipped } = parseReport(await file.text());
  if (!mapping.orderId || !mapping.commission) {
    return {
      error: "Không nhận diện được cột Mã đơn hàng / Hoa hồng. Kiểm tra lại file (phải là CSV) và danh sách cột bên dưới.",
      mapping,
      headers,
    };
  }

  // Orders are attributed to a link when any sub_id equals the link's slug
  const slugToId = new Map((await db.select({ id: links.id, slug: links.slug }).from(links)).map((l) => [l.slug, l.id]));
  const now = Date.now();
  let matched = 0;

  const rows = parsed.map((o) => {
    const linkId = o.subIds.map((s) => slugToId.get(s.toLowerCase())).find((id) => id !== undefined) ?? null;
    if (linkId) matched++;
    return {
      platform,
      orderId: o.orderId,
      itemKey: o.itemKey,
      productName: o.productName,
      status: o.status,
      rawStatus: o.rawStatus,
      orderValue: o.orderValue,
      commission: o.commission,
      subIds: o.subIds.join("|") || null,
      linkId,
      orderTime: o.orderTime,
      importedAt: now,
    };
  });

  // Re-importing a newer report updates status/commission of existing orders
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(orders)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [orders.platform, orders.orderId, orders.itemKey],
        set: {
          status: sql`excluded.status`,
          rawStatus: sql`excluded.raw_status`,
          orderValue: sql`excluded.order_value`,
          commission: sql`excluded.commission`,
          subIds: sql`excluded.sub_ids`,
          linkId: sql`excluded.link_id`,
          productName: sql`excluded.product_name`,
        },
      });
  }

  revalidatePath("/");
  return { imported: rows.length, matched, skipped, mapping, headers };
}
