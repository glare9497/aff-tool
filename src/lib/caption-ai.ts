import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

const CaptionsSchema = z.object({
  captions: z.array(z.object({ accountId: z.number(), caption: z.string() })),
});

export type CaptionAccount = { id: number; platform: string; name: string; niche: string | null };

export type CaptionInput = {
  productName: string;
  productInfo: string;
  scriptSummary: string | null;
  accounts: CaptionAccount[];
};

const SYSTEM = `Bạn viết caption đăng bài affiliate cho nhiều Fanpage Facebook, tài khoản Instagram và TikTok ở Việt Nam.

Viết một caption riêng cho từng tài khoản trong danh sách. Các caption phải khác nhau rõ rệt về câu mở đầu, cách diễn đạt và bố cục, vì đăng nội dung giống hệt nhau lên nhiều trang dễ bị nền tảng đánh dấu spam. Giữ đúng giọng của ngách mà tài khoản đó theo đuổi.

Theo nền tảng:
- facebook: 3-6 câu, câu đầu gây tò mò, có thể dùng emoji vừa phải, kết bằng lời mời xem link. Không tự viết URL, hệ thống sẽ chèn link.
- instagram: câu mở đầu mạnh, xuống dòng dễ đọc, kết bằng "link ở bio", 5-10 hashtag ở cuối. Không viết URL.
- tiktok: 1-2 câu ngắn, kêu gọi bấm giỏ hàng, 3-6 hashtag. Không viết URL.

Chỉ dùng thông tin sản phẩm được cung cấp. Không bịa số liệu, không hứa hẹn tuyệt đối, không công dụng y tế.`;

export async function generateCaptions(input: CaptionInput) {
  const client = new Anthropic();
  const prompt = [
    `Sản phẩm: ${input.productName}`,
    `Thông tin sản phẩm:\n${input.productInfo || "(không có)"}`,
    input.scriptSummary && `Kịch bản video đi kèm:\n${input.scriptSummary}`,
    `Các tài khoản cần caption (JSON):\n${JSON.stringify(input.accounts)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.beta.messages.parse({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(CaptionsSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude từ chối yêu cầu này. Thử diễn đạt lại thông tin sản phẩm.");
  if (response.stop_reason === "max_tokens") throw new Error("Kết quả bị cắt giữa chừng. Thử chọn ít tài khoản hơn.");
  if (!response.parsed_output) throw new Error("Không đọc được kết quả từ Claude. Thử lại.");
  return response.parsed_output.captions;
}
