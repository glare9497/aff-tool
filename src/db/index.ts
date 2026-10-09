import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local: file:./data/aff.db — Production: Turso URL + auth token
const client = createClient({
  url: process.env.DATABASE_URL || "file:./data/aff.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
});

export const db = drizzle(client, { schema });

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  channel TEXT NOT NULL,
  origin_url TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  referer TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS clicks_link_ts ON clicks (link_id, ts);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  order_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  product_name TEXT,
  status TEXT NOT NULL,
  raw_status TEXT,
  order_value REAL NOT NULL,
  commission REAL NOT NULL,
  sub_ids TEXT,
  link_id INTEGER,
  order_time INTEGER,
  imported_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_unique ON orders (platform, order_id, item_key);
CREATE TABLE IF NOT EXISTS scripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER,
  product_name TEXT NOT NULL,
  format TEXT NOT NULL,
  duration INTEGER NOT NULL,
  input TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  name TEXT NOT NULL,
  handle TEXT,
  niche TEXT,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  external_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_external ON accounts (platform, external_id);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  link_id INTEGER,
  script_id INTEGER,
  media_type TEXT NOT NULL,
  media_key TEXT,
  media_url TEXT,
  media_size INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS post_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  account_id INTEGER NOT NULL,
  caption TEXT NOT NULL,
  first_comment TEXT,
  status TEXT NOT NULL,
  scheduled_at INTEGER,
  published_at INTEGER,
  external_id TEXT,
  permalink TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS post_targets_due ON post_targets (status, scheduled_at);
`;

let ready: Promise<void> | null = null;

/** Creates tables on first use, so there is no separate migration step. */
export function ensureSchema() {
  // Drop a failed attempt so the next call retries instead of reusing the rejection
  ready ??= client.executeMultiple(SCHEMA_SQL).catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
