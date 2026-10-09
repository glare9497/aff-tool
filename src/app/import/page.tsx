"use client";

import { useActionState } from "react";
import { importReport } from "./actions";

const FIELD_LABELS: Record<string, string> = {
  orderId: "Mã đơn hàng",
  itemId: "Mã sản phẩm",
  productName: "Tên sản phẩm",
  status: "Trạng thái",
  orderValue: "Giá trị đơn",
  commission: "Hoa hồng",
  orderTime: "Thời gian đặt",
  subIds: "Sub ID",
};

export default function ImportPage() {
  const [state, action, pending] = useActionState(importReport, {});

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Import báo cáo đơn hàng</h1>

      <form action={action} className="card space-y-3">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Shopee Affiliate → Báo cáo → Báo cáo chuyển đổi → Xuất dữ liệu (CSV).</li>
          <li>TikTok Shop: Affiliate Center → Đơn hàng → Xuất (CSV).</li>
          <li>Import lại file mới bất cứ lúc nào: đơn cũ sẽ được cập nhật trạng thái, không bị trùng.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <select name="platform" className="input w-40" defaultValue="shopee">
            <option value="shopee">Shopee</option>
            <option value="tiktok">TikTok Shop</option>
            <option value="other">Khác</option>
          </select>
          <input name="file" type="file" accept=".csv,text/csv" className="text-sm" required />
          <button className="btn" disabled={pending}>
            {pending ? "Đang import..." : "Import"}
          </button>
        </div>
      </form>

      {state.error && <p className="card text-sm text-red-600">{state.error}</p>}

      {state.imported !== undefined && (
        <div className="card text-sm">
          ✅ Đã import <b>{state.imported}</b> dòng, trong đó <b>{state.matched}</b> dòng khớp với link của bạn qua Sub ID.
          {!!state.skipped && <> Bỏ qua {state.skipped} dòng không có mã đơn.</>}
        </div>
      )}

      {state.mapping && (
        <div className="card">
          <h2 className="mb-2 text-sm font-medium">Cột được nhận diện</h2>
          <table className="table">
            <tbody>
              {Object.entries(state.mapping).map(([field, col]) => (
                <tr key={field}>
                  <td className="w-40 text-muted">{FIELD_LABELS[field] ?? field}</td>
                  <td>{col ?? <span className="text-red-600">không tìm thấy</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {state.headers && (
            <p className="mt-3 text-xs text-muted">Tất cả cột trong file: {state.headers.join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
