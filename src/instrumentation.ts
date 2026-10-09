// Local scheduler: publishes due posts every minute while `npm run dev` / `npm start` runs.
// Serverless deployments have no long-running process, so they use /api/cron instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL || process.env.DISABLE_LOCAL_SCHEDULER) return;
  const { runDuePosts } = await import("@/lib/social/publisher");

  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await runDuePosts();
      if (r.started || r.advanced) console.log(`[scheduler] đăng ${r.started}, cập nhật ${r.advanced}, lỗi ${r.failed}`);
    } catch (e) {
      console.error("[scheduler]", e);
    } finally {
      running = false;
    }
  }, 60_000);
}
