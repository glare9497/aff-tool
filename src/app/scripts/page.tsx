import Link from "next/link";
import { desc } from "drizzle-orm";
import { connection } from "next/server";
import { db, ensureSchema } from "@/db";
import { links, scripts } from "@/db/schema";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video-formats";
import { deleteScript } from "./actions";
import { ScriptForm } from "./script-form";

// Always rendered per request: reads live data
export const instant = false;

export default async function ScriptsPage() {
  await connection();
  await ensureSchema();
  const [linkOptions, history] = await Promise.all([
    db.select({ id: links.id, title: links.title }).from(links).orderBy(desc(links.createdAt)),
    db
      .select({ id: scripts.id, productName: scripts.productName, format: scripts.format, duration: scripts.duration, createdAt: scripts.createdAt })
      .from(scripts)
      .orderBy(desc(scripts.createdAt))
      .limit(30),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">AI viết kịch bản video</h1>
      <ScriptForm links={linkOptions} hasKey={Boolean(process.env.ANTHROPIC_API_KEY)} />

      <section className="card">
        <h2 className="mb-2 font-medium">Kịch bản đã viết</h2>
        <table className="table">
          <tbody>
            {history.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/scripts/${s.id}`} className="font-medium hover:underline">
                    {s.productName}
                  </Link>
                  <div className="text-xs text-muted">
                    {VIDEO_FORMATS[s.format as VideoFormat]?.split(/[:(]/)[0].trim() ?? s.format} · {s.duration}s ·{" "}
                    {new Date(s.createdAt).toLocaleString("vi-VN")}
                  </div>
                </td>
                <td className="w-20 text-right">
                  <form action={deleteScript}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="btn-ghost text-red-600">Xoá</button>
                  </form>
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td className="py-6 text-center text-muted">Chưa có kịch bản nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
