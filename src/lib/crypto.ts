import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Platform access tokens are stored encrypted with a key derived from AUTH_SECRET.
function key() {
  return createHash("sha256").update(`token-enc:${process.env.AUTH_SECRET ?? "dev-secret-change-me"}`).digest();
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decrypt(value: string | null) {
  if (!value) return null;
  const [, iv, tag, data] = value.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
