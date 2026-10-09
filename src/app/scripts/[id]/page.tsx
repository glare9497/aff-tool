import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { scripts } from "@/db/schema";
import type { VideoScript } from "@/lib/script-ai";
import { ScriptView } from "../script-view";

// Always rendered per request: reads params and live data
export const instant = false;

export default async function ScriptDetailPage({ params }: PageProps<"/scripts/[id]">) {
  const { id } = await params;
  await connection();
  await ensureSchema();
  const row = await db.query.scripts.findFirst({ where: eq(scripts.id, Number(id)) });
  if (!row) notFound();

  return (
    <div className="space-y-4">
      <Link href="/scripts" className="text-sm text-muted hover:underline">
        ← Quay lại
      </Link>
      <h1 className="text-xl font-semibold">{row.productName}</h1>
      <ScriptView script={JSON.parse(row.output) as VideoScript} />
    </div>
  );
}
