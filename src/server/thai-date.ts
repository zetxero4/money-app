// วันที่ทั้งหมดคิดตามเวลาไทย (Asia/Bangkok, UTC+7 ไม่มี daylight saving)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** วันที่วันนี้ตามเวลาไทย รูปแบบ YYYY-MM-DD */
export function todayInBangkok(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export type Period = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "last_7_days" | "last_30_days";

export interface DateRange {
  from: string;
  to: string;
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function monthEnd(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${date.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

/** ช่วงวันที่ของ period ที่อ้างอิงจาก today (สัปดาห์เริ่มวันจันทร์) */
export function rangeForPeriod(period: Period, today: string = todayInBangkok()): DateRange {
  switch (period) {
    case "today":
      return { from: today, to: today };
    case "this_week": {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = อาทิตย์
      const offset = (dow + 6) % 7;
      return { from: addDays(today, -offset), to: addDays(today, 6 - offset) };
    }
    case "this_month":
      return { from: monthStart(today), to: monthEnd(today) };
    case "last_month": {
      const prev = addDays(monthStart(today), -1);
      return { from: monthStart(prev), to: monthEnd(prev) };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "last_7_days":
      return { from: addDays(today, -6), to: today };
    case "last_30_days":
      return { from: addDays(today, -29), to: today };
  }
}

/** ช่วงก่อนหน้าสำหรับเทียบ: เดือนเทียบเดือน ปีเทียบปี นอกนั้นเลื่อนถอยหลังเท่าจำนวนวัน */
export function previousRange(range: DateRange): DateRange {
  const isWholeMonth = range.from === monthStart(range.from) && range.to === monthEnd(range.from);
  if (isWholeMonth) {
    const prev = addDays(range.from, -1);
    return { from: monthStart(prev), to: monthEnd(prev) };
  }
  const isWholeYear = range.from.endsWith("-01-01") && range.to === `${range.from.slice(0, 4)}-12-31`;
  if (isWholeYear) {
    const y = Number(range.from.slice(0, 4)) - 1;
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  const len = daysBetweenInclusive(range.from, range.to);
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) };
}
