"use client";

import { useActionState, useState } from "react";
import { bulkCreateLinks, createLink, type FormState } from "./actions";
import { CHANNELS } from "@/lib/format";

function Result({ state }: { state: FormState }) {
  return (
    <>
      {state.ok && <p className="text-sm text-green-600">{state.ok}</p>}
      {state.error && <p className="whitespace-pre-line text-sm text-red-600">{state.error}</p>}
    </>
  );
}

function ChannelSelect() {
  return (
    <select name="channel" className="input" defaultValue="tiktok">
      {CHANNELS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

export function LinkForms({ hasApi }: { hasApi: boolean }) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [single, singleAction, singlePending] = useActionState(createLink, {});
  const [bulk, bulkAction, bulkPending] = useActionState(bulkCreateLinks, {});

  const tab = (m: typeof mode) => `btn-ghost ${mode === m ? "border-accent text-accent" : ""}`;

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={tab("single")} onClick={() => setMode("single")}>
          Tạo 1 link
        </button>
        <button type="button" className={tab("bulk")} onClick={() => setMode("bulk")}>
          Tạo hàng loạt
        </button>
        <span className="ml-auto self-center text-xs text-muted">
          {hasApi
            ? "✅ Shopee API đã kết nối: link affiliate được tạo tự động"
            : "⚠️ Chưa có Shopee API: dán link affiliate tạo từ trang Shopee Affiliate"}
        </span>
      </div>

      {mode === "single" ? (
        <form action={singleAction} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label">Link sản phẩm *</label>
            <input name="originUrl" className="input" placeholder="https://shopee.vn/..." required />
          </div>
          <div className="md:col-span-2">
            <label className="label">
              Link affiliate {hasApi ? "(bỏ trống để tạo tự động)" : "(bỏ trống nếu link ở trên đã là link affiliate)"}
            </label>
            <input name="affiliateUrl" className="input" placeholder="https://s.shopee.vn/..." />
          </div>
          <div>
            <label className="label">Tên sản phẩm / video</label>
            <input name="title" className="input" placeholder="Nồi chiên không dầu 5L" />
          </div>
          <div>
            <label className="label">Slug (a-z, 0-9; bỏ trống để tự sinh)</label>
            <input name="slug" className="input" placeholder="noichien01" pattern="[a-zA-Z0-9]{3,40}" />
          </div>
          <div>
            <label className="label">Kênh</label>
            <ChannelSelect />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input name="note" className="input" placeholder="Hook: đừng mua nồi chiên khi chưa xem video này" />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <button className="btn" disabled={singlePending}>
              {singlePending ? "Đang tạo..." : "Tạo link"}
            </button>
            <Result state={single} />
          </div>
        </form>
      ) : (
        <form action={bulkAction} className="space-y-3">
          <div>
            <label className="label">Mỗi dòng 1 sản phẩm: link, hoặc link | tên sản phẩm</label>
            <textarea
              name="lines"
              rows={8}
              className="input font-mono"
              placeholder={"https://shopee.vn/product/123/456 | Máy hút bụi mini\nhttps://shopee.vn/product/789/012"}
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-40">
              <ChannelSelect />
            </div>
            <button className="btn" disabled={bulkPending}>
              {bulkPending ? "Đang tạo..." : "Tạo tất cả"}
            </button>
          </div>
          <Result state={bulk} />
        </form>
      )}
    </div>
  );
}
