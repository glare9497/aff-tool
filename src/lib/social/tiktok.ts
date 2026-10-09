import { PlatformError } from "./meta";

/**
 * TikTok Login Kit + Content Posting API, "upload to inbox" mode: the video lands
 * in the creator's TikTok drafts; they add the product (giỏ hàng) and publish in
 * the app. Direct public posting needs an audited app, so it is not used here.
 */

export const TIKTOK_SCOPES = ["user.info.basic", "video.upload"];

const apiBase = () => process.env.TIKTOK_API_BASE || "https://open.tiktokapis.com";

export function hasTikTokApp() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
}

export function tiktokAuthUrl(redirectUri: string, state: string) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", process.env.TIKTOK_CLIENT_KEY!);
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export type TikTokTokens = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  open_id: string;
};

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${apiBase()}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error || !json.access_token) {
    throw new PlatformError(`TikTok OAuth: ${json.error_description || json.error || `HTTP ${res.status}`}`);
  }
  return json as TikTokTokens;
}

export const exchangeTikTokCode = (code: string, redirectUri: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });

export const refreshTikTokToken = (refreshToken: string) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });

async function api<T>(path: string, token: string, body?: unknown, method = "POST") {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json.error && json.error.code !== "ok")) {
    throw new PlatformError(`TikTok API: ${json.error?.message || json.error?.code || `HTTP ${res.status}`}`);
  }
  return json.data as T;
}

export async function tiktokUserInfo(token: string) {
  const data = await api<{ user: { open_id: string; display_name: string } }>(
    "/v2/user/info/?fields=open_id,display_name",
    token,
    undefined,
    "GET",
  );
  return data.user;
}

const MAX_SINGLE_CHUNK = 64 * 1024 * 1024;
const CHUNK = 10 * 1024 * 1024;

/** Uploads a video to the creator's TikTok inbox; returns the publish_id to poll. */
export async function uploadToInbox(token: string, video: Buffer, mime: string) {
  const size = video.length;
  // Files up to 64MB go in one chunk; larger ones use 10MB chunks with the remainder in the last one
  const chunkSize = size <= MAX_SINGLE_CHUNK ? size : CHUNK;
  const totalChunks = size <= MAX_SINGLE_CHUNK ? 1 : Math.floor(size / CHUNK);

  const init = await api<{ publish_id: string; upload_url: string }>("/v2/post/publish/inbox/video/init/", token, {
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunks },
  });

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = i === totalChunks - 1 ? size : start + chunkSize;
    const res = await fetch(init.upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Length": String(end - start),
        "Content-Range": `bytes ${start}-${end - 1}/${size}`,
      },
      body: new Uint8Array(video.subarray(start, end)),
    });
    if (!res.ok) throw new PlatformError(`TikTok upload lỗi ở phần ${i + 1}/${totalChunks}: HTTP ${res.status}`);
  }
  return init.publish_id;
}

/** PROCESSING_UPLOAD | PROCESSING_DOWNLOAD | SEND_TO_USER_INBOX | PUBLISH_COMPLETE | FAILED */
export async function tiktokPublishStatus(token: string, publishId: string) {
  return api<{ status: string; fail_reason?: string }>("/v2/post/publish/status/fetch/", token, { publish_id: publishId });
}
