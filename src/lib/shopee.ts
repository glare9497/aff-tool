import { createHash } from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.vn/graphql";

export function hasShopeeApi() {
  return Boolean(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);
}

/** Shopee only accepts letters and digits in sub_id. */
export function toSubId(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 50);
}

/**
 * Calls Shopee Affiliate Open API `generateShortLink`.
 * Signature = SHA256(AppId + Timestamp + Payload + Secret).
 */
export async function generateShopeeShortLink(originUrl: string, subIds: string[]) {
  const appId = process.env.SHOPEE_APP_ID!;
  const secret = process.env.SHOPEE_APP_SECRET!;

  const query = `mutation($input: ShortLinkInput!) { generateShortLink(input: $input) { shortLink } }`;
  const payload = JSON.stringify({
    query,
    variables: { input: { originUrl, subIds: subIds.map(toSubId).filter(Boolean).slice(0, 5) } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHash("sha256").update(`${appId}${timestamp}${payload}${secret}`).digest("hex");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });
  const json = await res.json();
  const shortLink = json?.data?.generateShortLink?.shortLink;
  if (!shortLink) {
    const msg = json?.errors?.[0]?.message ?? `HTTP ${res.status}`;
    throw new Error(`Shopee API lỗi: ${msg}`);
  }
  return shortLink as string;
}
