import Link from "next/link";
import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db, ensureSchema } from "@/db";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";

const PERIODS = [
  { days: 7, label: "7 ngày" },
  { days: 30, label: "30 ngày" },
  { days: 90, label: "90 ngày" },
  { days: 0, label: "Tất cả" },
];

type LinkStat = { id: number; title: string; slug: string; channel: string; clicks: number; orders: number; commission: number };
type Totals = { orders: number; commission: number; completed: number; pending: number; attributed: number };
type ProductStat = { name: string; orders: number; commission: number };

/** Start of the reporting window in ms; 0 means all time. */
function periodStart(days: number) {
  return days > 0 ? Date.now() - days * 86_400_000 : 0;
}

// Orders without an order time fall back to the time they were imported
const ORDER_TIME = sql.raw("coalesce(o.order_time, o.imported_at)");

// Always rendered per request: reads cookies, search params and live data
export const instant = false;

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  await connection();
  await ensureSchema();
  const days = Number((await searchParams).days ?? 30);
  const since = periodStart(days);

  const [[{ clicks }], [totals], linkStats, products] = await Promise.all([
    db.all<{ clicks: number }>(sql`SELECT count(*) AS clicks FROM clicks WHERE ts >= ${since}`),
    db.all<Totals>(sql`
      SELECT count(DISTINCT CASE WHEN status != 'cancelled' THEN order_id END) AS orders,
             coalesce(sum(CASE WHEN status != 'cancelled' THEN commission END), 0) AS commission,
             coalesce(sum(CASE WHEN status = 'completed' THEN commission END), 0) AS completed,
             coalesce(sum(CASE WHEN status = 'pending' THEN commission END), 0) AS pending,
             coalesce(sum(CASE WHEN status != 'cancelled' AND link_id IS NOT NULL THEN commission END), 0) AS attributed
      FROM orders o WHERE ${ORDER_TIME} >= ${since}`),
    db.all<LinkStat>(sql`
      SELECT l.id, l.title, l.slug, l.channel,
        (SELECT count(*) FROM clicks c WHERE c.link_id = l.id AND c.ts >= ${since}) AS clicks,
        (SELECT count(DISTINCT o.order_id) FROM orders o
          WHERE o.link_id = l.id AND o.status != 'cancelled' AND ${ORDER_TIME} >= ${since}) AS orders,
        (SELECT coalesce(sum(o.commission), 0) FROM orders o
          WHERE o.link_id = l.id AND o.status != 'cancelled' AND ${ORDER_TIME} >= ${since}) AS commission
      FROM links l
      ORDER BY commission DESC, clicks DESC
      LIMIT 50`),
    db.all<ProductStat>(sql`
      SELECT coalesce(product_name, '(không rõ)') AS name,
             count(DISTINCT order_id) AS orders,
             sum(commission) AS commission
      FROM orders o
      WHERE status != 'cancelled' AND ${ORDER_TIME} >= ${since}
      GROUP BY name ORDER BY commission DESC LIMIT 10`),
  ]);

  const channels = new Map<string, { clicks: number; orders: number; commission: number }>();
  for (const l of linkStats) {
    const c = channels.get(l.channel) ?? { clicks: 0, orders: 0, commission: 0 };
    c.clicks += l.clicks;
    c.orders += l.orders;
    c.commission += l.commission;
    channels.set(l.channel, c);
  }
  const unattributed = totals.commission - totals.attributed;

  const tiles = [
    { label: "Clicks", value: fmtNum(clicks) },
    { label: "Đơn hàng", value: fmtNum(totals.orders) },
    { label: "Hoa hồng (chờ + duyệt)", value: fmtMoney(totals.commission) },
    { label: "Đã hoàn thành", value: fmtMoney(totals.completed), sub: `Đang chờ ${fmtMoney(totals.pending)}` },
    {
      label: "EPC (tiền / click)",
      value: clicks ? fmtMoney(totals.attributed / clicks) : "—",
      sub: "Chỉ tính đơn khớp Sub ID",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Dashboard</h1>
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/?days=${p.days}`}
            className={`btn-ghost ${p.days === days ? "border-accent text-accent" : ""}`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="card">
            <div className="text-xs text-muted">{t.label}</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{t.value}</div>
            {t.sub && <div className="mt-1 text-xs text-muted">{t.sub}</div>}
          </div>
        ))}
      </div>

      <section className="card overflow-x-auto">
        <h2 className="mb-2 font-medium">Hiệu quả theo link / video</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Link</th>
              <th>Kênh</th>
              <th className="num">Clicks</th>
              <th className="num">Đơn</th>
              <th className="num">CR</th>
              <th className="num">Hoa hồng</th>
              <th className="num">EPC</th>
            </tr>
          </thead>
          <tbody>
            {linkStats.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="font-medium">{l.title}</div>
                  <div className="font-mono text-xs text-muted">/go/{l.slug}</div>
                </td>
                <td>{l.channel}</td>
                <td className="num">{fmtNum(l.clicks)}</td>
                <td className="num">{fmtNum(l.orders)}</td>
                <td className="num">{l.clicks ? fmtPct(l.orders / l.clicks) : "—"}</td>
                <td className="num font-medium">{fmtMoney(l.commission)}</td>
                <td className="num">{l.clicks ? fmtMoney(l.commission / l.clicks) : "—"}</td>
              </tr>
            ))}
            {linkStats.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  Chưa có dữ liệu. Tạo link ở trang <Link href="/links" className="underline">Links</Link>, rồi{" "}
                  <Link href="/import" className="underline">import báo cáo</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="mb-2 font-medium">Theo kênh</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Kênh</th>
                <th className="num">Clicks</th>
                <th className="num">Đơn</th>
                <th className="num">Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {[...channels].map(([name, c]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="num">{fmtNum(c.clicks)}</td>
                  <td className="num">{fmtNum(c.orders)}</td>
                  <td className="num">{fmtMoney(c.commission)}</td>
                </tr>
              ))}
              {unattributed > 0 && (
                <tr>
                  <td className="text-muted" title="Đơn không có Sub ID khớp slug, ví dụ đơn từ giỏ hàng TikTok">
                    Chưa gán link
                  </td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                  <td className="num">{fmtMoney(unattributed)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <h2 className="mb-2 font-medium">Top sản phẩm ra tiền</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th className="num">Đơn</th>
                <th className="num">Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name}>
                  <td className="max-w-xs truncate">{p.name}</td>
                  <td className="num">{fmtNum(p.orders)}</td>
                  <td className="num">{fmtMoney(p.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
