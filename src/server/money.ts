// เงินเก็บเป็นสตางค์ (จำนวนเต็ม) เสมอ เพื่อเลี่ยงปัญหาทศนิยมของ float

/** แปลงข้อความหรือตัวเลขบาทเป็นสตางค์ เช่น "28,000" → 2800000, "65.5" → 6550 คืน null ถ้าไม่ถูกต้อง */
export function bahtToSatang(input: string | number): number | null {
  const text = String(input).replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const satang = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang) || satang <= 0) return null;
  return satang;
}

/** สตางค์ → ข้อความบาท เช่น 2800000 → "28,000", 6550 → "65.50" */
export function formatBaht(satang: number): string {
  const sign = satang < 0 ? "-" : "";
  const abs = Math.abs(satang);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = abs % 100;
  return frac === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(frac).padStart(2, "0")}`;
}

/** สตางค์ → ตัวเลขบาท (ใช้ส่งออกให้ Claude/หน้าเว็บ) */
export function satangToBaht(satang: number): number {
  return satang / 100;
}
