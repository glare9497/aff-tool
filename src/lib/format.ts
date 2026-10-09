const vnd = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

export const fmtMoney = (n: number) => `${vnd.format(Math.round(n))}₫`;
export const fmtNum = (n: number) => vnd.format(n);
export const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

export const CHANNELS = ["tiktok", "facebook", "telegram", "zalo", "other"] as const;
export const PLATFORMS = ["shopee", "tiktok", "other"] as const;

export const SOCIAL_PLATFORMS = {
  facebook: { label: "Facebook Page", icon: "📘" },
  instagram: { label: "Instagram", icon: "📸" },
  tiktok: { label: "TikTok", icon: "🎵" },
} as const;
export type SocialPlatform = keyof typeof SOCIAL_PLATFORMS;

const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  day: "2-digit",
  month: "2-digit",
});

/** Always Vietnam time, also when the server runs in UTC. */
export const fmtTime = (ms: number | null) => (ms ? timeFmt.format(ms) : "—");
