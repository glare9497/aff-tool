import Papa from "papaparse";

/**
 * Parses order/commission reports exported from Shopee Affiliate or TikTok Shop.
 * Column names differ between platforms, languages and report versions, so each
 * field lists candidate headers and is matched after normalising (lowercase,
 * no diacritics, letters/digits only).
 */

export type ParsedOrder = {
  orderId: string;
  itemKey: string;
  productName: string | null;
  status: "pending" | "completed" | "cancelled";
  rawStatus: string | null;
  orderValue: number;
  commission: number;
  subIds: string[];
  orderTime: number | null;
};

type Field = "orderId" | "itemId" | "productName" | "status" | "orderValue" | "commission" | "orderTime";

const CANDIDATES: Record<Field, string[]> = {
  orderId: ["ID đơn hàng", "Mã đơn hàng", "Order ID", "Order id"],
  itemId: ["Item ID", "ID sản phẩm", "Mã sản phẩm", "Product ID", "SKU ID"],
  productName: ["Tên Item", "Tên sản phẩm", "Item Name", "Product Name", "Product name"],
  status: ["Trạng thái đặt hàng", "Trạng thái đơn hàng", "Trạng thái", "Order Status", "Status"],
  orderValue: [
    "Giá trị đơn hàng (₫)",
    "Giá trị mua(₫)",
    "Giá trị đơn hàng",
    "Purchase Value",
    "Order Amount",
    "Payment Amount",
    "GMV",
    "Giá(₫)",
    "Price",
  ],
  commission: [
    "Hoa hồng ròng tiếp thị liên kết(₫)",
    "Tổng hoa hồng đơn hàng(₫)",
    "Hoa hồng ròng",
    "Tổng hoa hồng",
    "Hoa hồng ước tính",
    "Net Commission",
    "Affiliate Net Commission",
    "Total Commission",
    "Est. commission",
    "Estimated commission",
    "Commission",
    "Hoa hồng",
  ],
  orderTime: ["Thời gian đặt hàng", "Thời gian tạo đơn", "Purchase Time", "Order Time", "Order created time", "Created Time"],
};

const SUB_ID_RE = /^subid([1-5])$/;

export function normalizeHeader(h: string) {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumn(headers: string[], candidates: string[]) {
  const norm = headers.map(normalizeHeader);
  for (const c of candidates) {
    const i = norm.indexOf(normalizeHeader(c));
    if (i >= 0) return headers[i];
  }
  // Fall back to a prefix match, e.g. "Hoa hồng ròng tiếp thị liên kết (VND)"
  for (const c of candidates) {
    const nc = normalizeHeader(c);
    const i = norm.findIndex((h) => h.startsWith(nc));
    if (i >= 0) return headers[i];
  }
  return null;
}

/** Handles "1.234.567", "1,234,567", "₫12,345", "1234.56", "1.234,5". */
export function parseMoney(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").replace(/[^0-9.,-]/g, "");
  if (!s) return 0;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimal = lastDot > lastComma ? "." : ",";
    const thousands = decimal === "." ? "," : ".";
    s = s.split(thousands).join("").replace(decimal, ".");
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (sep) {
      const parts = s.split(sep);
      const isThousands = parts.length > 2 || parts[parts.length - 1].length === 3;
      s = isThousands ? parts.join("") : parts.join(".");
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Handles "2026-10-01 12:34:56" and "01/10/2026 12:34" (day first). */
export function parseDate(raw: unknown): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, d, m, y, hh = "0", mm = "0", ss = "0"] = dmy;
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss).getTime();
  }
  const t = Date.parse(s.replace(" ", "T"));
  return Number.isNaN(t) ? null : t;
}

export function normalizeStatus(raw: string | null): ParsedOrder["status"] {
  const s = normalizeHeader(raw ?? "");
  if (/huy|cancel|invalid|khonghople|refund|hoantien|tuchoi|reject/.test(s)) return "cancelled";
  if (/hoanthanh|complete|settled|dathanhtoan|paid|approved|dangduyet|daduyet/.test(s)) return "completed";
  return "pending";
}

export type ParseResult = {
  orders: ParsedOrder[];
  mapping: Record<string, string | null>;
  headers: string[];
  skipped: number;
};

export function parseReport(csv: string): ParseResult {
  // Strip BOM
  const text = csv.replace(/^﻿/, "");
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];

  const mapping: Record<string, string | null> = {};
  for (const f of Object.keys(CANDIDATES) as Field[]) mapping[f] = findColumn(headers, CANDIDATES[f]);
  const subIdCols = headers
    .map((h) => ({ h, m: normalizeHeader(h).match(SUB_ID_RE) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]))
    .map((x) => x.h);
  mapping.subIds = subIdCols.join(", ") || null;

  if (!mapping.orderId || !mapping.commission) {
    return { orders: [], mapping, headers, skipped: parsed.data.length };
  }

  const orders: ParsedOrder[] = [];
  let skipped = 0;
  parsed.data.forEach((row, i) => {
    const get = (col: string | null) => (col ? (row[col] ?? "").toString().trim() : "");
    const orderId = get(mapping.orderId);
    if (!orderId) {
      skipped++;
      return;
    }
    const rawStatus = get(mapping.status) || null;
    orders.push({
      orderId,
      itemKey: get(mapping.itemId) || `row${i}`,
      productName: get(mapping.productName) || null,
      status: normalizeStatus(rawStatus),
      rawStatus,
      orderValue: parseMoney(get(mapping.orderValue)),
      commission: parseMoney(get(mapping.commission)),
      subIds: subIdCols.map((c) => get(c)).filter((v) => v && v !== "-"),
      orderTime: parseDate(get(mapping.orderTime)),
    });
  });

  return { orders, mapping, headers, skipped };
}
