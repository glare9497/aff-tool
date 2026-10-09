"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, ensureSchema } from "@/db";
import { scripts } from "@/db/schema";
import { describeAiError, generateVideoScript, type ScriptInput, type VideoScript } from "@/lib/script-ai";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video-formats";

export type GenerateState = { error?: string; id?: number; script?: VideoScript };

export async function generateScript(_prev: GenerateState, formData: FormData): Promise<GenerateState> {
  await ensureSchema();
  const format = String(formData.get("format") ?? "hands");
  const input: ScriptInput = {
    productName: String(formData.get("productName") ?? "").trim(),
    productInfo: String(formData.get("productInfo") ?? "").trim().slice(0, 8000),
    format: (format in VIDEO_FORMATS ? format : "hands") as VideoFormat,
    duration: [15, 30, 60].includes(Number(formData.get("duration"))) ? Number(formData.get("duration")) : 30,
    audience: String(formData.get("audience") ?? "").trim(),
    extra: String(formData.get("extra") ?? "").trim(),
  };
  if (!input.productName) return { error: "Nhập tên sản phẩm" };
  const linkId = Number(formData.get("linkId")) || null;

  let script: VideoScript;
  try {
    script = await generateVideoScript(input);
  } catch (e) {
    return { error: describeAiError(e) };
  }

  const [row] = await db
    .insert(scripts)
    .values({
      linkId,
      productName: input.productName,
      format: input.format,
      duration: input.duration,
      input: JSON.stringify(input),
      output: JSON.stringify(script),
      createdAt: Date.now(),
    })
    .returning({ id: scripts.id });

  revalidatePath("/scripts");
  return { id: row.id, script };
}

export async function deleteScript(formData: FormData) {
  await db.delete(scripts).where(eq(scripts.id, Number(formData.get("id"))));
  revalidatePath("/scripts");
}
