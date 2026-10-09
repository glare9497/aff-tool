import { createHash } from "node:crypto";

const ENDPOINT = "https://open-api.affiliate.shopee.vn/graphql";

export function hasShopeeApi() {
  return Boolean(process.env.SHOPEE_APP_ID && process.env.SHOPEE_APP_SECRET);
}

export function hasShopeeAffiliateId() {
  return Boolean(process.env.SHOPEE_AFFILIATE_ID);
}

/** Affiliate links already generated in the Shopee portal (s.shopee.vn/xxx, shope.ee/xxx). */
export function isShopeeAffiliateLink(url: string) {
  const host = new URL(url).hostname;
  return host === "s.shopee.vn" || host.endsWith("shope.ee");
}

/**
 * Builds an affiliate link without the Open API, using the long `an_redir` format.
 * Unofficial: Shopee does not document it, so verify attribution with a test order.
 */
export function buildShopeeRedirectLink(originUrl: string, subIds: string[]) {
  const url = new URL("https://s.shopee.vn/an_redir");
  url.searchParams.set("origin_link", originUrl);
  url.searchParams.set("affiliate_id", process.env.SHOPEE_AFFILIATE_ID!);
  // Sub IDs are joined with "-" and land in the report's Sub_id1..Sub_id5 columns
  url.searchParams.set("sub_id", subIds.map(toSubId).filter(Boolean).slice(0, 5).join("-"));
  return url.toString();
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
