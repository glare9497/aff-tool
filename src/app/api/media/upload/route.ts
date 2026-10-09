import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { isAllowedMime, newMediaKey, saveLocal } from "@/lib/storage";

// Local-storage uploads. Excluded from the proxy (which would buffer large bodies),
// so the session is checked here instead.
export async function POST(request: Request) {
  if (!isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) return new Response("Unauthorized", { status: 401 });
  const mime = request.headers.get("content-type") ?? "";
  if (!isAllowedMime(mime)) return Response.json({ error: "Chỉ nhận ảnh JPG/PNG/WEBP hoặc video MP4/MOV" }, { status: 400 });

  const data = Buffer.from(await request.arrayBuffer());
  const key = newMediaKey(mime);
  await saveLocal(key, data);
  return Response.json({ key, url: null, size: data.length });
}
