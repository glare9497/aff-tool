import { readFile } from "node:fs/promises";
import { localPath, mimeOf } from "@/lib/storage";

/** Serves locally stored media for previews in the dashboard. */
export async function GET(_request: Request, ctx: RouteContext<"/media/[...key]">) {
  const key = (await ctx.params).key.join("/");
  try {
    const data = await readFile(localPath(key));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": mimeOf(key), "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
