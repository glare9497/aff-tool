import { hasR2, isAllowedMime, newMediaKey, presignUpload, publicUrl } from "@/lib/storage";

/** R2 uploads: the browser PUTs the file straight to the bucket with this URL. */
export async function POST(request: Request) {
  if (!hasR2()) return Response.json({ error: "Chưa cấu hình R2" }, { status: 400 });
  const { mime } = (await request.json()) as { mime: string };
  if (!isAllowedMime(mime)) return Response.json({ error: "Chỉ nhận ảnh JPG/PNG/WEBP hoặc video MP4/MOV" }, { status: 400 });
  const key = newMediaKey(mime);
  return Response.json({ key, uploadUrl: await presignUpload(key, mime), url: publicUrl(key) });
}
