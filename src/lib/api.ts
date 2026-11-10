// ตัวช่วยเรียก /api จากหน้าเว็บ (ฝั่งเบราว์เซอร์)

export type Kind = "income" | "expense";

export interface Transaction {
  id: string;
  kind: Kind;
  amountSatang: number;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  note: string;
  occurredOn: string;
  source: "web" | "claude";
  createdAt: string;
  deletedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
}

export interface Totals {
  from: string;
  to: string;
  incomeSatang: number;
  expenseSatang: number;
  netSatang: number;
  count: number;
  byCategory: Array<{ categoryId: string | null; categoryName: string; icon: string | null; kind: Kind; totalSatang: number; count: number }>;
}

export interface Summary {
  current: Totals;
  previous: Totals;
  expenseChangeByCategory: Array<{ categoryName: string; current: number; previous: number; change: number }>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? "GET",
    headers: init.body !== undefined || (init.method && init.method !== "GET") ? { "Content-Type": "application/json" } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : init.method && init.method !== "GET" ? "{}" : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(res.status, (data as { error?: string }).error ?? "เกิดข้อผิดพลาด");
  }
  return data as T;
}

export function formatBaht(satang: number): string {
  const abs = Math.abs(satang);
  const text = (abs / 100).toLocaleString("th-TH", { minimumFractionDigits: abs % 100 ? 2 : 0, maximumFractionDigits: 2 });
  return `${satang < 0 ? "-" : ""}${text}`;
}

const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function formatThaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${TH_MONTHS[m - 1]} ${String(y + 543).slice(-2)}`;
}

export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
