"use client";

import { type Summary, formatBaht, formatThaiDate } from "@/lib/api";
import { cn } from "@/lib/utils";

export const HERO_PERIODS = [
  { value: "this_month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนก่อน" },
  { value: "this_year", label: "ปีนี้" },
] as const;

// แบบ C: แถบสีน้ำเงินเข้ม ยอดคงเหลือตัวใหญ่ + รายรับ/รายจ่าย
export function HomeHero({
  period,
  onPeriod,
  summary,
}: {
  period: string;
  onPeriod: (p: string) => void;
  summary: Summary | null;
}) {
  const cur = summary?.current;
  return (
    <section className="flex flex-col gap-4 rounded-[28px] bg-ink p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          คงเหลือ{cur ? ` ${formatThaiDate(cur.from)} – ${formatThaiDate(cur.to)}` : ""}
        </p>
        <div className="flex rounded-full bg-white/15 p-1" role="group" aria-label="ช่วงเวลา">
          {HERO_PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriod(p.value)}
              aria-pressed={period === p.value}
              className={cn(
                "min-h-8 rounded-full px-3 text-[13px] font-medium transition-colors",
                period === p.value ? "bg-white text-ink" : "text-white hover:bg-white/10",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[44px] leading-[56px] font-bold tracking-tight tabular-nums">
        {cur ? formatBaht(cur.netSatang) : "—"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col rounded-2xl bg-sun px-4 py-2.5 text-ink">
          <span className="text-xs">รายรับ</span>
          <span className="text-lg font-bold tabular-nums">+{cur ? formatBaht(cur.incomeSatang) : "0"}</span>
        </div>
        <div className="flex flex-col rounded-2xl bg-white px-4 py-2.5 text-ink">
          <span className="text-xs">รายจ่าย</span>
          <span className="text-lg font-bold tabular-nums">-{cur ? formatBaht(cur.expenseSatang) : "0"}</span>
        </div>
      </div>
    </section>
  );
}
