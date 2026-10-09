"use client";

import { useState, useTransition } from "react";
import { SOCIAL_PLATFORMS, type SocialPlatform } from "@/lib/format";
import { aiCaptions, createPost, type NewPost } from "../actions";

type AccountOption = { id: number; platform: string; name: string; niche: string | null; connected: boolean };
type LinkOption = { id: number; title: string; url: string };
type ScriptOption = { id: number; productName: string; caption: string };
type UploadedMedia = NonNullable<NewPost["media"]> & { preview: string };
type Draft = { caption: string; firstComment: string };

const LINK_TEXT = (url: string) => `👉 Link mua: ${url}`;

/** Uploads with progress: straight to R2 when configured, otherwise to the local server. */
async function upload(file: File, useR2: boolean, onProgress: (p: number) => void): Promise<UploadedMedia> {
  let target = "/api/media/upload";
  let method = "POST";
  let key = "";
  let url: string | null = null;
  if (useR2) {
    const res = await fetch("/api/media/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mime: file.type }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Không tạo được link upload");
    ({ key, url } = json);
    target = json.uploadUrl;
    method = "PUT";
  }

  // XMLHttpRequest instead of fetch: fetch cannot report upload progress
  const responseText = await new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, target);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onerror = () => reject(new Error("Upload thất bại (kiểm tra mạng / CORS của bucket R2)"));
    xhr.onload = () =>
      xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(`Upload lỗi: ${xhr.responseText || xhr.status}`));
    xhr.send(file);
  });
  if (!useR2) ({ key, url } = JSON.parse(responseText));

  return {
    type: file.type.startsWith("video") ? "video" : "image",
    key,
    url,
    size: file.size,
    preview: URL.createObjectURL(file),
  };
}

export function PostForm(props: { accounts: AccountOption[]; links: LinkOption[]; scripts: ScriptOption[]; hasR2: boolean; hasAiKey: boolean }) {
  const [title, setTitle] = useState("");
  const [productInfo, setProductInfo] = useState("");
  const [linkId, setLinkId] = useState<number | null>(null);
  const [scriptId, setScriptId] = useState<number | null>(null);
  const [media, setMedia] = useState<UploadedMedia | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [fbLinkInComment, setFbLinkInComment] = useState(true);
  const [mode, setMode] = useState<NewPost["mode"]>("now");
  const [when, setWhen] = useState("");
  const [stagger, setStagger] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [aiPending, startAi] = useTransition();
  const [savePending, startSave] = useTransition();

  const link = props.links.find((l) => l.id === linkId) ?? null;
  const accountById = new Map(props.accounts.map((a) => [a.id, a]));

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const setDraft = (id: number, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { caption: "", firstComment: "" }), ...patch } }));

  /** Puts the affiliate link where each platform can use it. */
  function withLink(accountId: number, caption: string): Draft {
    const platform = accountById.get(accountId)?.platform;
    if (!link || platform !== "facebook") return { caption, firstComment: "" };
    return fbLinkInComment ? { caption, firstComment: LINK_TEXT(link.url) } : { caption: `${caption}\n\n${LINK_TEXT(link.url)}`, firstComment: "" };
  }

  function fillFromScript() {
    const s = props.scripts.find((x) => x.id === scriptId);
    if (!s) return;
    setDrafts((d) => {
      const next = { ...d };
      for (const id of selected) next[id] = withLink(id, s.caption);
      return next;
    });
  }

  function runAi() {
    setError(null);
    startAi(async () => {
      const res = await aiCaptions({ productName: title, productInfo, scriptId, accountIds: selected });
      if (res.error) return setError(res.error);
      setDrafts((d) => {
        const next = { ...d };
        for (const c of res.captions ?? []) next[c.accountId] = withLink(c.accountId, c.caption);
        return next;
      });
    });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      setMedia(await upload(file, props.hasR2, setProgress));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  function submit() {
    setError(null);
    startSave(async () => {
      const res = await createPost({
        title,
        linkId,
        scriptId,
        media: media ? { type: media.type, key: media.key, url: media.url, size: media.size } : null,
        targets: selected.map((id) => ({ accountId: id, caption: drafts[id]?.caption ?? "", firstComment: drafts[id]?.firstComment ?? "" })),
        mode,
        scheduledAt: mode === "schedule" && when ? new Date(when).getTime() : null,
        staggerMinutes: stagger,
      });
      if (res?.error) setError(res.error);
    });
  }

  const grouped = Object.keys(SOCIAL_PLATFORMS).map((p) => ({
    platform: p as SocialPlatform,
    items: props.accounts.filter((a) => a.platform === p),
  }));

  return (
    <div className="space-y-4">
      {/* 1. Content */}
      <section className="card grid gap-3 md:grid-cols-2">
        <h2 className="font-medium md:col-span-2">1. Nội dung</h2>
        <div>
          <label className="label">Tên bài / sản phẩm *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Máy hút bụi mini - video review" />
        </div>
        <div>
          <label className="label">Link affiliate (Facebook sẽ gắn link này)</label>
          <select className="input" value={linkId ?? ""} onChange={(e) => setLinkId(Number(e.target.value) || null)}>
            <option value="">(không gắn)</option>
            {props.links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Kịch bản AI đã viết (tuỳ chọn)</label>
          <select className="input" value={scriptId ?? ""} onChange={(e) => setScriptId(Number(e.target.value) || null)}>
            <option value="">(không dùng)</option>
            {props.scripts.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.id} {s.productName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Ảnh / video {props.hasR2 ? "(lưu trên R2)" : "(lưu trên máy; Instagram cần R2)"}</label>
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
          {progress !== null && <div className="mt-1 text-xs text-muted">Đang tải lên... {Math.round(progress * 100)}%</div>}
          {media && (
            <div className="mt-2 flex items-center gap-2">
              {media.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.preview} alt="" className="h-20 rounded" />
              ) : (
                <video src={media.preview} className="h-20 rounded" muted />
              )}
              <button type="button" className="btn-ghost" onClick={() => setMedia(null)}>
                Bỏ
              </button>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <label className="label">Thông tin sản phẩm cho AI viết caption (giá, tính năng, review)</label>
          <textarea className="input" rows={3} value={productInfo} onChange={(e) => setProductInfo(e.target.value)} />
        </div>
      </section>

      {/* 2. Accounts */}
      <section className="card space-y-3">
        <h2 className="font-medium">2. Đăng lên tài khoản nào</h2>
        {props.accounts.length === 0 && (
          <p className="text-sm text-muted">
            Chưa có tài khoản. Thêm ở trang <a href="/accounts" className="underline">Tài khoản</a>.
          </p>
        )}
        {grouped.map(
          (g) =>
            g.items.length > 0 && (
              <div key={g.platform}>
                <div className="label">
                  {SOCIAL_PLATFORMS[g.platform].icon} {SOCIAL_PLATFORMS[g.platform].label}
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((a) => (
                    <label key={a.id} className={`btn-ghost flex items-center gap-2 ${selected.includes(a.id) ? "border-accent" : ""}`}>
                      <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                      {a.name}
                      {!a.connected && <span className="text-xs text-muted">(thủ công)</span>}
                    </label>
                  ))}
                </div>
              </div>
            ),
        )}
      </section>

      {/* 3. Captions */}
      {selected.length > 0 && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto font-medium">3. Caption cho từng tài khoản</h2>
            <label className="flex items-center gap-1 text-xs text-muted">
              <input type="checkbox" checked={fbLinkInComment} onChange={(e) => setFbLinkInComment(e.target.checked)} />
              Facebook: để link ở bình luận đầu (đỡ bị giảm tiếp cận)
            </label>
            {scriptId && (
              <button type="button" className="btn-ghost" onClick={fillFromScript}>
                Dùng caption từ kịch bản
              </button>
            )}
            <button type="button" className="btn" onClick={runAi} disabled={aiPending || !props.hasAiKey}>
              {aiPending ? "Claude đang viết..." : "✨ AI viết caption riêng cho từng tài khoản"}
            </button>
          </div>
          {selected.map((id) => {
            const a = accountById.get(id)!;
            return (
              <div key={id} className="rounded-lg border border-border p-3">
                <div className="mb-1 text-sm font-medium">
                  {SOCIAL_PLATFORMS[a.platform as SocialPlatform]?.icon} {a.name}
                </div>
                <textarea
                  className="input"
                  rows={4}
                  value={drafts[id]?.caption ?? ""}
                  onChange={(e) => setDraft(id, { caption: e.target.value })}
                  placeholder="Caption..."
                />
                {a.platform === "facebook" && (
                  <input
                    className="input mt-2"
                    value={drafts[id]?.firstComment ?? ""}
                    onChange={(e) => setDraft(id, { firstComment: e.target.value })}
                    placeholder="Bình luận đầu tiên (tuỳ chọn), ví dụ link mua"
                  />
                )}
                {a.platform === "tiktok" && (
                  <p className="mt-1 text-xs text-muted">Video vào hộp nháp TikTok; caption để bạn copy khi đăng trong app.</p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* 4. Schedule */}
      <section className="card space-y-3">
        <h2 className="font-medium">4. Thời gian</h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {(
            [
              ["now", "Đăng ngay"],
              ["schedule", "Hẹn giờ"],
              ["draft", "Lưu nháp"],
            ] as const
          ).map(([m, label]) => (
            <label key={m} className="flex items-center gap-1">
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} /> {label}
            </label>
          ))}
          {mode === "schedule" && <input type="datetime-local" className="input w-56" value={when} onChange={(e) => setWhen(e.target.value)} />}
          {mode !== "draft" && (
            <label className="flex items-center gap-1">
              Giãn cách giữa các tài khoản
              <input type="number" min={0} className="input w-20" value={stagger} onChange={(e) => setStagger(Number(e.target.value))} />
              phút
            </label>
          )}
        </div>
        {error && <p className="whitespace-pre-line text-sm text-red-600">{error}</p>}
        <button type="button" className="btn" onClick={submit} disabled={savePending || progress !== null}>
          {savePending ? "Đang lưu..." : mode === "now" ? "Đăng" : mode === "schedule" ? "Lên lịch" : "Lưu nháp"}
        </button>
      </section>
    </div>
  );
}
