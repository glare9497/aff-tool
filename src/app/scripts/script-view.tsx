import { CopyButton } from "@/components/copy-button";
import type { VideoScript } from "@/lib/script-ai";

export function ScriptView({ script }: { script: VideoScript }) {
  const voiceover = script.scenes.map((s) => s.voiceover).join("\n");
  const caption = `${script.caption}\n\n${script.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`;

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="label">Góc tiếp cận</div>
        <p className="text-sm">{script.angle}</p>
      </div>

      <div className="card">
        <h3 className="mb-2 font-medium">3 hook để test (3 giây đầu)</h3>
        <ol className="space-y-2">
          {script.hooks.map((h, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 text-xs font-semibold text-accent">#{i + 1}</span>
              <div className="flex-1">
                <div className="font-medium">{h.text}</div>
                <div className="text-xs text-muted">{h.why}</div>
              </div>
              <CopyButton text={h.text} />
            </li>
          ))}
        </ol>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-2 flex items-center gap-2">
          <h3 className="mr-auto font-medium">Kịch bản từng cảnh</h3>
          <CopyButton text={voiceover} label="Copy lời đọc (dán vào CapCut)" />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th className="w-16">Thời gian</th>
              <th>Cảnh quay</th>
              <th>Lời đọc</th>
              <th>Chữ trên màn hình</th>
            </tr>
          </thead>
          <tbody>
            {script.scenes.map((s, i) => (
              <tr key={i} className="align-top">
                <td className="font-mono text-xs">{s.time}</td>
                <td>{s.visual}</td>
                <td>{s.voiceover}</td>
                <td className="font-medium">{s.onScreenText}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">
          <span className="text-muted">Kêu gọi hành động:</span> {script.cta}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="mb-2 flex items-center">
            <h3 className="mr-auto font-medium">Caption + hashtag</h3>
            <CopyButton text={caption} />
          </div>
          <p className="whitespace-pre-line text-sm">{caption}</p>
        </div>
        <div className="card">
          <h3 className="mb-2 font-medium">Cần quay / chuẩn bị</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {script.shotList.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </div>

      {script.warnings.length > 0 && (
        <div className="card border-amber-400/60">
          <h3 className="mb-2 font-medium">⚠️ Lưu ý tránh vi phạm</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {script.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
