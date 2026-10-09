export const VIDEO_FORMATS = {
  hands: "Quay tay: unbox / demo dùng thử thật, không lộ mặt",
  slideshow: "Ảnh + clip sản phẩm, giọng đọc AI, chữ trên màn hình",
  top: "Top / so sánh nhiều sản phẩm cùng loại",
  problem: "Vấn đề → giải pháp (nỗi đau của khách rồi đưa sản phẩm ra)",
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;
