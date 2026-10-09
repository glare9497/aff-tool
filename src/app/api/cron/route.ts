import { timingSafeEqual } from "node:crypto";
import { runDuePosts } from "@/lib/social/publisher";

// Called every few minutes by an external scheduler (e.g. cron-job.org) when deployed.
// Locally, src/instrumentation.ts runs the same job on a timer.
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? new URL(request.url).searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await runDuePosts());
}
