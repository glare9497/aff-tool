import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  platform: text("platform").notNull(), // shopee | tiktok | other
  channel: text("channel").notNull(), // tiktok | facebook | telegram | zalo | other
  originUrl: text("origin_url").notNull(),
  affiliateUrl: text("affiliate_url").notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

export const clicks = sqliteTable(
  "clicks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    linkId: integer("link_id").notNull(),
    ts: integer("ts").notNull(),
    referer: text("referer"),
    userAgent: text("user_agent"),
  },
  (t) => [index("clicks_link_ts").on(t.linkId, t.ts)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    platform: text("platform").notNull(),
    orderId: text("order_id").notNull(),
    itemKey: text("item_key").notNull(), // item id, or row index when the report has none
    productName: text("product_name"),
    status: text("status").notNull(), // pending | completed | cancelled
    rawStatus: text("raw_status"),
    orderValue: real("order_value").notNull(),
    commission: real("commission").notNull(),
    subIds: text("sub_ids"), // sub_id1..5 joined with "|"
    linkId: integer("link_id"),
    orderTime: integer("order_time"),
    importedAt: integer("imported_at").notNull(),
  },
  (t) => [uniqueIndex("orders_unique").on(t.platform, t.orderId, t.itemKey)],
);

export type Link = typeof links.$inferSelect;

export const scripts = sqliteTable("scripts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  linkId: integer("link_id"),
  productName: text("product_name").notNull(),
  format: text("format").notNull(),
  duration: integer("duration").notNull(),
  input: text("input").notNull(), // JSON of the form fields
  output: text("output").notNull(), // JSON of the generated VideoScript
  createdAt: integer("created_at").notNull(),
});

/** A Facebook Page, Instagram professional account or TikTok account. */
export const accounts = sqliteTable("accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  platform: text("platform").notNull(), // facebook | instagram | tiktok
  name: text("name").notNull(),
  handle: text("handle"),
  niche: text("niche"),
  note: text("note"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  externalId: text("external_id"), // page id / ig user id / tiktok open_id
  accessToken: text("access_token"), // encrypted
  refreshToken: text("refresh_token"), // encrypted
  tokenExpiresAt: integer("token_expires_at"),
  createdAt: integer("created_at").notNull(),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  linkId: integer("link_id"),
  scriptId: integer("script_id"),
  mediaType: text("media_type").notNull(), // none | image | video
  mediaKey: text("media_key"), // storage key
  mediaUrl: text("media_url"), // public URL when storage is public
  mediaSize: integer("media_size"),
  createdAt: integer("created_at").notNull(),
});

/** One post going to one account, with its own caption, schedule and status. */
export const postTargets = sqliteTable(
  "post_targets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id").notNull(),
    accountId: integer("account_id").notNull(),
    caption: text("caption").notNull(),
    firstComment: text("first_comment"), // Facebook: posted as the first comment, e.g. the affiliate link
    // draft | scheduled | publishing | processing | published | inbox | manual | failed | cancelled
    status: text("status").notNull(),
    scheduledAt: integer("scheduled_at"),
    publishedAt: integer("published_at"),
    externalId: text("external_id"), // container id / publish id while processing, post id when done
    permalink: text("permalink"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("post_targets_due").on(t.status, t.scheduledAt)],
);

export type Account = typeof accounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type PostTarget = typeof postTargets.$inferSelect;
