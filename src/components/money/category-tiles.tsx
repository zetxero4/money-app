"use client";

import Link from "next/link";
import { ChartPie } from "lucide-react";
import { CategoryIcon } from "@/components/money/category-icon";
import { type Summary, formatBaht } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICON_BG = ["bg-brand text-white", "bg-coral text-ink", "bg-sun text-ink"];

// แบบ C: การ์ดหมวดรายจ่ายสูงสุด 3 หมวด + ลิงก์ไปหน้าสรุปเต็ม
export function CategoryTiles({ summary }: { summary: Summary | null }) {
  const expenses = summary?.current.byCategory.filter((c) => c.kind === "expense") ?? [];
  const total = Math.max(1, summary?.current.expenseSatang ?? 0);
  const top = expenses.slice(0, 3);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">เงินหายไปไหน</h2>
      {summary && expenses.length === 0 ? (
        <p className="rounded-2xl bg-surface-alt p-5 text-center text-sm text-muted-foreground">ยังไม่มีรายจ่ายในช่วงนี้</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {top.map((c, i) => {
            const pct = Math.round((c.totalSatang / total) * 100);
            return (
              <div key={c.categoryName} className="flex flex-col gap-2 rounded-2xl bg-surface-alt p-3.5">
                <span className={cn("flex size-9 items-center justify-center rounded-full", ICON_BG[i % ICON_BG.length])}>
                  <CategoryIcon name={c.icon} className="size-[18px]" />
                </span>
                <span className="truncate text-sm">{c.categoryName}</span>
                <span className="text-xl font-bold tabular-nums">{formatBaht(c.totalSatang)}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-xs text-muted-foreground">
                  {pct}% · {c.count} รายการ
                </span>
              </div>
            );
          })}
          <Link
            href="/summary"
            className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border p-3.5 text-sm hover:bg-surface-alt"
          >
            <ChartPie className="size-5" />
            สรุปเต็ม{expenses.length > 3 ? ` (+${expenses.length - 3} หมวด)` : ""}
          </Link>
        </div>
      )}
    </section>
  );
}
