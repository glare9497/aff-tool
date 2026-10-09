"use client";

import Link from "next/link";
import { useActionState } from "react";
import { VIDEO_FORMATS } from "@/lib/video-formats";
import { generateScript } from "./actions";
import { ScriptView } from "./script-view";

type LinkOption = { id: number; title: string };

export function ScriptForm({ links, hasKey }: { links: LinkOption[]; hasKey: boolean }) {
  const [state, action, pending] = useActionState(generateScript, {});

  return (
    <div className="space-y-6">
      {!hasKey && (
        <p className="card text-sm text-amber-600">
          Chưa có <code>ANTHROPIC_API_KEY</code>. Tạo key tại console.anthropic.com, thêm vào <code>.env.local</code> rồi
          khởi động lại app.
        </p>
      )}

      <form action={action} className="card grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Tên sản phẩm *</label>
          <input name="productName" className="input" placeholder="Máy hút bụi cầm tay mini không dây" required />
        </div>
        <div>
          <label className="label">Gắn với link (để theo dõi doanh thu)</label>
          <select name="linkId" className="input" defaultValue="">
            <option value="">(không gắn)</option>
            {links.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Thông tin sản phẩm: copy mô tả, giá, tính năng, review hay từ trang Shopee</label>
          <textarea
            name="productInfo"
            rows={6}
            className="input"
            placeholder={"Giá 189k, lực hút 6000Pa, pin 30 phút, sạc Type-C, nặng 450g...\nReview: hút được cả lông mèo trên sofa, nhỏ gọn để trong ô tô"}
          />
        </div>
        <div>
          <label className="label">Định dạng video</label>
          <select name="format" className="input" defaultValue="hands">
            {Object.entries(VIDEO_FORMATS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Thời lượng</label>
          <select name="duration" className="input" defaultValue="30">
            <option value="15">15 giây</option>
            <option value="30">30 giây</option>
            <option value="60">60 giây</option>
          </select>
        </div>
        <div>
          <label className="label">Khán giả mục tiêu</label>
          <input name="audience" className="input" placeholder="Mẹ bỉm sữa, người ở trọ, dân văn phòng..." />
        </div>
        <div>
          <label className="label">Yêu cầu thêm</label>
          <input name="extra" className="input" placeholder="Giọng hài hước, nhấn mạnh giá rẻ..." />
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <button className="btn" disabled={pending || !hasKey}>
            {pending ? "Claude đang viết... (~20-60 giây)" : "Viết kịch bản"}
          </button>
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          {state.id && !pending && (
            <Link href={`/scripts/${state.id}`} className="text-sm text-muted underline">
              Đã lưu (#{state.id})
            </Link>
          )}
        </div>
      </form>

      {state.script && !pending && <ScriptView script={state.script} />}
    </div>
  );
}
