/**
 * Facebook Pages + Instagram professional accounts through the Meta Graph API
 * ("Instagram API with Facebook Login": the IG account is linked to a Page and
 * uses that Page's access token).
 */

export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

const version = () => process.env.META_GRAPH_VERSION || "v23.0";
const graphBase = () => process.env.META_GRAPH_BASE || "https://graph.facebook.com";
const videoBase = () => process.env.META_GRAPH_VIDEO_BASE || process.env.META_GRAPH_BASE || "https://graph-video.facebook.com";

export function hasMetaApp() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export class PlatformError extends Error {}

type Params = Record<string, string | number | undefined>;

async function graph<T>(path: string, opts: { method?: "GET" | "POST"; params?: Params; body?: FormData; base?: string } = {}) {
  const url = new URL(`${opts.base ?? graphBase()}/${version()}/${path.replace(/^\//, "")}`);
  const params = Object.entries(opts.params ?? {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, String(v)]);
  let body: FormData | URLSearchParams | undefined;
  if (opts.method === "POST" && opts.body) {
    for (const [k, v] of params) opts.body.append(k, v);
    body = opts.body;
  } else if (opts.method === "POST") {
    body = new URLSearchParams(params);
  } else {
    for (const [k, v] of params) url.searchParams.set(k, v);
  }

  const res = await fetch(url, { method: opts.method ?? "GET", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new PlatformError(`Meta API: ${e.error_user_msg || e.message || `HTTP ${res.status}`}${e.code ? ` (code ${e.code})` : ""}`);
  }
  return json as T;
}

// ---------- OAuth ----------

export function metaAuthUrl(redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${version()}/dialog/oauth`);
  url.searchParams.set("client_id", process.env.META_APP_ID!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

/** Code → long-lived user token. Page tokens derived from it do not expire. */
export async function exchangeMetaCode(code: string, redirectUri: string) {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    params: { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: redirectUri, code },
  });
  const long = await graph<{ access_token: string }>("oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: short.access_token,
    },
  });
  return long.access_token;
}

export type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string; name?: string };
};

export async function listPages(userToken: string) {
  const res = await graph<{ data: MetaPage[] }>("me/accounts", {
    params: { fields: "id,name,access_token,instagram_business_account{id,username,name}", limit: 100, access_token: userToken },
  });
  return res.data;
}

// ---------- Facebook Page publishing ----------

export type Media = { type: "image" | "video"; data: Buffer; mime: string; url: string | null };

export async function publishToPage(opts: { pageId: string; token: string; caption: string; media: Media | null; firstComment?: string | null }) {
  const { pageId, token, caption, media } = opts;
  let postId: string;
  let permalink: string | null = null;

  if (!media) {
    // A URL in the message becomes a link preview automatically
    const res = await graph<{ id: string }>(`${pageId}/feed`, { method: "POST", params: { message: caption, access_token: token } });
    postId = res.id;
  } else if (media.type === "image") {
    const form = new FormData();
    form.append("source", new Blob([new Uint8Array(media.data)], { type: media.mime }), "image");
    const res = await graph<{ id: string; post_id?: string }>(`${pageId}/photos`, {
      method: "POST",
      body: form,
      params: { message: caption, access_token: token },
    });
    postId = res.post_id ?? res.id;
  } else {
    const form = new FormData();
    form.append("source", new Blob([new Uint8Array(media.data)], { type: media.mime }), "video.mp4");
    const res = await graph<{ id: string }>(`${pageId}/videos`, {
      method: "POST",
      body: form,
      base: videoBase(),
      params: { description: caption, access_token: token },
    });
    postId = res.id;
    permalink = `https://www.facebook.com/${pageId}/videos/${res.id}`;
  }

  if (opts.firstComment) {
    await graph(`${postId}/comments`, { method: "POST", params: { message: opts.firstComment, access_token: token } });
  }
  if (!permalink) {
    const info = await graph<{ permalink_url?: string }>(postId, { params: { fields: "permalink_url", access_token: token } }).catch(
      () => ({}) as { permalink_url?: string },
    );
    permalink = info.permalink_url ?? `https://www.facebook.com/${postId}`;
  }
  return { postId, permalink };
}

// ---------- Instagram publishing (container → wait → publish) ----------

export async function createIgContainer(opts: { igUserId: string; token: string; caption: string; media: Media }) {
  if (!opts.media.url) {
    throw new PlatformError("Instagram cần file ở link công khai: cấu hình Cloudflare R2 (xem DEPLOY.md) rồi tạo lại bài.");
  }
  const params: Params =
    opts.media.type === "image"
      ? { image_url: opts.media.url, caption: opts.caption, access_token: opts.token }
      : { media_type: "REELS", video_url: opts.media.url, caption: opts.caption, access_token: opts.token };
  const res = await graph<{ id: string }>(`${opts.igUserId}/media`, { method: "POST", params });
  return res.id;
}

/** FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED */
export async function igContainerStatus(containerId: string, token: string) {
  const res = await graph<{ status_code: string; status?: string }>(containerId, { params: { fields: "status_code,status", access_token: token } });
  return res;
}

export async function publishIgContainer(igUserId: string, token: string, containerId: string) {
  const res = await graph<{ id: string }>(`${igUserId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId, access_token: token },
  });
  const info = await graph<{ permalink?: string }>(res.id, { params: { fields: "permalink", access_token: token } }).catch(
    () => ({}) as { permalink?: string },
  );
  return { mediaId: res.id, permalink: info.permalink ?? null };
}
