import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Media storage. With Cloudflare R2 configured, files live in a public bucket
 * (required for Instagram, which fetches media by URL). Without it, files are
 * kept in data/media — fine for local use and for Facebook/TikTok uploads.
 */

const LOCAL_DIR = path.join(process.cwd(), "data", "media");

export function hasR2() {
  return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

function r2() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function isAllowedMime(mime: string) {
  return mime in EXT;
}

export function newMediaKey(mime: string) {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}/${randomBytes(8).toString("hex")}.${EXT[mime] ?? "bin"}`;
}

/** Public URL of a stored file, or null when it is only reachable locally. */
export function publicUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  return hasR2() && base ? `${base}/${key}` : null;
}

/** URL the browser PUTs the file to directly (R2 only). */
export async function presignUpload(key: string, mime: string) {
  return getSignedUrl(r2(), new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: mime }), {
    expiresIn: 600,
  });
}

export async function saveLocal(key: string, data: Buffer) {
  const file = path.join(LOCAL_DIR, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
}

export function localPath(key: string) {
  const file = path.normalize(path.join(LOCAL_DIR, key));
  if (!file.startsWith(LOCAL_DIR)) throw new Error("Invalid media key");
  return file;
}

export async function readMedia(key: string): Promise<Buffer> {
  if (hasR2()) {
    const res = await r2().send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function deleteMedia(key: string) {
  if (hasR2()) await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
  else await unlink(localPath(key)).catch(() => {});
}

export function mimeOf(key: string) {
  const ext = key.split(".").pop();
  return Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
}
