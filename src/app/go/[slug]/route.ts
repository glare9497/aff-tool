import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { clicks, links } from "@/db/schema";

const BOT_RE = /bot|crawler|spider|preview|facebookexternalhit|curl|wget|headless/i;

export async function GET(request: Request, ctx: RouteContext<"/go/[slug]">) {
  const { slug } = await ctx.params;
  await ensureSchema();
  const link = await db.query.links.findFirst({ where: eq(links.slug, slug.toLowerCase()) });
  if (!link) return new Response("Link không tồn tại", { status: 404 });

  const userAgent = request.headers.get("user-agent") ?? "";
  if (!BOT_RE.test(userAgent)) {
    after(() =>
      db.insert(clicks).values({
        linkId: link.id,
        ts: Date.now(),
        referer: request.headers.get("referer"),
        userAgent: userAgent.slice(0, 300),
      }),
    );
  }

  return Response.redirect(link.affiliateUrl, 302);
}
