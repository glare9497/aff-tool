export const TARGET_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Nháp", cls: "bg-gray-500/15 text-muted" },
  scheduled: { label: "Đã hẹn giờ", cls: "bg-blue-500/15 text-blue-600" },
  publishing: { label: "Đang đăng", cls: "bg-blue-500/15 text-blue-600" },
  processing: { label: "Nền tảng đang xử lý", cls: "bg-blue-500/15 text-blue-600" },
  published: { label: "Đã đăng", cls: "bg-green-500/15 text-green-600" },
  inbox: { label: "Trong nháp TikTok: mở app để đăng", cls: "bg-amber-500/15 text-amber-600" },
  manual: { label: "Cần đăng tay", cls: "bg-amber-500/15 text-amber-600" },
  failed: { label: "Lỗi", cls: "bg-red-500/15 text-red-600" },
  cancelled: { label: "Đã huỷ", cls: "bg-gray-500/15 text-muted" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = TARGET_STATUS[status] ?? { label: status, cls: "" };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}
