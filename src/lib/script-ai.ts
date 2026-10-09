import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { VIDEO_FORMATS, type VideoFormat } from "./video-formats";

export const VideoScriptSchema = z.object({
  angle: z.string().describe("Góc tiếp cận: insight / nỗi đau khách hàng mà video đánh vào"),
  hooks: z
    .array(z.object({ text: z.string(), why: z.string().describe("Vì sao hook này giữ chân người xem") }))
    .describe("3 hook khác nhau cho 3 giây đầu, để test A/B"),
  scenes: z.array(
    z.object({
      time: z.string().describe('Mốc thời gian, vd "0-3s"'),
      visual: z.string().describe("Cảnh quay cụ thể: góc máy, tay làm gì, cận cảnh gì"),
      voiceover: z.string().describe("Lời đọc, văn nói tự nhiên"),
      onScreenText: z.string().describe("Chữ hiện trên màn hình, ngắn gọn"),
    }),
  ),
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
  shotList: z.array(z.string()).describe("Danh sách cảnh cần quay/chuẩn bị trước khi dựng"),
  warnings: z.array(z.string()).describe("Câu chữ nên tránh để không vi phạm chính sách / quảng cáo sai sự thật"),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;

export type ScriptInput = {
  productName: string;
  productInfo: string;
  format: VideoFormat;
  duration: number;
  audience: string;
  extra: string;
};

const SYSTEM = `Bạn là người viết kịch bản video ngắn TikTok cho các kênh affiliate Shopee / TikTok Shop ở Việt Nam, chuyên kênh không lộ mặt.

Mục tiêu của mỗi kịch bản là giữ người xem qua 3 giây đầu và khiến họ bấm vào giỏ hàng hoặc link ở bio. Viết lời đọc bằng tiếng Việt văn nói, tự nhiên như người thật đang chia sẻ, không giọng quảng cáo. Độ dài lời đọc phải vừa với thời lượng video (khoảng 3 từ mỗi giây). Mọi cảnh quay phải thực hiện được mà không cần lộ mặt: tay, sản phẩm, màn hình, không gian sử dụng.

Chỉ dùng công dụng và thông số có trong thông tin sản phẩm được cung cấp. Không bịa số liệu, không hứa hẹn tuyệt đối ("cam kết", "100%", "trị dứt điểm"), không công dụng y tế, không chê bai thương hiệu khác bằng tên. Nếu thông tin sản phẩm thiếu, viết theo hướng trải nghiệm chung và ghi chú điều cần kiểm tra trong phần warnings.`;

function buildPrompt(input: ScriptInput) {
  return [
    `Sản phẩm: ${input.productName}`,
    `Thông tin sản phẩm (giá, tính năng, đánh giá...):\n${input.productInfo || "(không có)"}`,
    `Định dạng video: ${VIDEO_FORMATS[input.format]}`,
    `Thời lượng: ${input.duration} giây`,
    input.audience && `Khán giả mục tiêu: ${input.audience}`,
    input.extra && `Yêu cầu thêm: ${input.extra}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateVideoScript(input: ScriptInput): Promise<VideoScript> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(VideoScriptSchema) },
    // Re-runs a safety-classifier decline on Anthropic's recommended fallback model
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: buildPrompt(input) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude từ chối yêu cầu này. Thử diễn đạt lại thông tin sản phẩm.");
  if (response.stop_reason === "max_tokens") throw new Error("Kịch bản bị cắt giữa chừng. Thử lại với thời lượng ngắn hơn.");
  if (!response.parsed_output) throw new Error("Không đọc được kết quả từ Claude. Thử lại.");
  return response.parsed_output;
}

/** Turns SDK errors into messages that say what to fix. */
export function describeAiError(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "API key không hợp lệ. Kiểm tra ANTHROPIC_API_KEY trong .env.local.";
  if (error instanceof Anthropic.PermissionDeniedError) return "API key không có quyền dùng model này.";
  if (error instanceof Anthropic.RateLimitError) return "Gọi API quá nhanh hoặc hết hạn mức. Chờ một lúc rồi thử lại.";
  if (error instanceof Anthropic.BadRequestError) {
    return /credit balance/i.test(error.message)
      ? "Tài khoản Anthropic hết credit. Nạp thêm tại console.anthropic.com."
      : `Yêu cầu không hợp lệ: ${error.message}`;
  }
  if (error instanceof Anthropic.APIConnectionError) return "Không kết nối được tới Anthropic API. Kiểm tra mạng.";
  if (error instanceof Anthropic.APIError) return `Lỗi API ${error.status}: ${error.message}`;
  if (error instanceof Error && /api key|apiKey|ANTHROPIC_API_KEY/i.test(error.message)) {
    return "Chưa có ANTHROPIC_API_KEY. Thêm vào .env.local rồi khởi động lại app.";
  }
  return error instanceof Error ? error.message : String(error);
}
