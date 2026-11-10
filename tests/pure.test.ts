import { describe, expect, it } from "vitest";
import { bahtToSatang, formatBaht } from "../src/server/money";
import { previousRange, rangeForPeriod, todayInBangkok } from "../src/server/thai-date";
import { parseEntry } from "../src/server/parse";

describe("money", () => {
  it("แปลงบาทเป็นสตางค์", () => {
    expect(bahtToSatang("28,000")).toBe(2_800_000);
    expect(bahtToSatang("65.5")).toBe(6550);
    expect(bahtToSatang(0.1 + 0.2)).toBeNull(); // ทศนิยมเกิน 2 ตำแหน่ง
    expect(bahtToSatang("0")).toBeNull();
    expect(bahtToSatang("-5")).toBeNull();
    expect(bahtToSatang("abc")).toBeNull();
  });
  it("จัดรูปแบบ", () => {
    expect(formatBaht(2_800_000)).toBe("28,000");
    expect(formatBaht(6550)).toBe("65.50");
  });
});

describe("เวลาไทย", () => {
  it("23:30 UTC = วันถัดไปในไทย", () => {
    expect(todayInBangkok(new Date("2026-11-09T23:30:00Z"))).toBe("2026-11-10");
    expect(todayInBangkok(new Date("2026-11-09T16:59:00Z"))).toBe("2026-11-09");
  });
  it("ช่วงเวลา", () => {
    expect(rangeForPeriod("last_month", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(rangeForPeriod("this_week", "2026-11-10")).toEqual({ from: "2026-11-09", to: "2026-11-15" });
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousRange({ from: "2026-11-04", to: "2026-11-10" })).toEqual({ from: "2026-10-28", to: "2026-11-03" });
  });
});

describe("parseEntry", () => {
  const today = "2026-11-10";
  it("หลายรายการในบรรทัดเดียว", () => {
    expect(parseEntry("ข้าวมันไก่ 60 กาแฟ 55", today)).toEqual([
      { note: "ข้าวมันไก่", amountSatang: 6000, kind: "expense", occurredOn: today },
      { note: "กาแฟ", amountSatang: 5500, kind: "expense", occurredOn: today },
    ]);
  });
  it("เมื่อวาน", () => {
    expect(parseEntry("เมื่อวานค่าแท็กซี่ 120", today)).toEqual([
      { note: "ค่าแท็กซี่", amountSatang: 12000, kind: "expense", occurredOn: "2026-11-09" },
    ]);
  });
  it("รายรับมีคอมมา", () => {
    expect(parseEntry("เงินเดือนเข้า 28,000", today)).toEqual([
      { note: "เงินเดือนเข้า", amountSatang: 2_800_000, kind: "income", occurredOn: today },
    ]);
  });
  it("มีคำว่าบาท และคั่นด้วยคอมมา", () => {
    expect(parseEntry("กะเพราไข่ดาว 65 บาท, ชาเย็น 40", today).map((i) => [i.note, i.amountSatang])).toEqual([
      ["กะเพราไข่ดาว", 6500],
      ["ชาเย็น", 4000],
    ]);
  });
  it("ไม่มีตัวเลข = ไม่มีรายการ", () => {
    expect(parseEntry("สวัสดี", today)).toEqual([]);
  });
});
