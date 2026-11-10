"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type Transaction, formatBaht, formatThaiDate, todayInBangkok } from "@/lib/api";

const timeFmt = new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

function dayLabel(date: string): string {
  const today = todayInBangkok();
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (date === today) return `วันนี้ · ${formatThaiDate(date)}`;
  if (date === y.toISOString().slice(0, 10)) return `เมื่อวาน · ${formatThaiDate(date)}`;
  return formatThaiDate(date);
}

// แบบ B: รายการของหนึ่งวันแสดงเป็นใบเสร็จ
export function DayReceipt({
  date,
  items,
  deleted,
  onEdit,
  onRestore,
}: {
  date: string;
  items: Transaction[];
  deleted?: boolean;
  onEdit: (tx: Transaction) => void;
  onRestore: (tx: Transaction) => void;
}) {
  const expense = items.filter((t) => t.kind === "expense").reduce((s, t) => s + t.amountSatang, 0);
  const income = items.filter((t) => t.kind === "income").reduce((s, t) => s + t.amountSatang, 0);

  return (
    <article className="flex flex-col drop-shadow-[0_1px_2px_rgb(12_0_179/0.08)]">
      <div className="flex flex-col gap-3 rounded-t-2xl bg-card px-5 pt-5 pb-4">
        <header className="flex flex-col items-center gap-0.5">
          <span className="text-xs tracking-[0.2em]">{deleted ? "รายการที่ลบแล้ว" : "ใบเสร็จประจำวัน"}</span>
          <h3 className="text-xl font-bold">{dayLabel(date)}</h3>
        </header>
        <div className="border-t-2 border-dashed border-border" />

        <ul className="flex flex-col gap-1">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => (deleted ? onRestore(t) : onEdit(t))}
                className="-mx-2 flex min-h-11 flex-1 flex-col rounded-lg px-2 py-1 text-left hover:bg-surface-alt"
                aria-label={`${deleted ? "กู้คืน" : "แก้ไข"} ${t.note || t.categoryName || "รายการ"} ${formatBaht(t.amountSatang)} บาท`}
              >
                <span className="flex w-full items-baseline gap-1.5 text-[15px]">
                  <span className="truncate">{t.note || t.categoryName || "ไม่มีชื่อ"}</span>
                  <span className="min-w-4 flex-1 border-b-2 border-dotted border-border" aria-hidden />
                  <span className="font-semibold tabular-nums">
                    {t.kind === "income" ? "+" : ""}
                    {formatBaht(t.amountSatang)}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {t.categoryName ?? "ไม่มีหมวด"} · {timeFmt.format(new Date(t.createdAt))}
                  {t.source === "claude" && (
                    <span className="-rotate-3 rounded-full border-[1.5px] border-ink bg-sun px-2 text-[11px] leading-4 font-semibold text-ink">
                      จาก Claude
                    </span>
                  )}
                </span>
              </button>
              {deleted && (
                <Button variant="ghost" size="icon-sm" onClick={() => onRestore(t)} aria-label="กู้คืน">
                  <RotateCcw />
                </Button>
              )}
            </li>
          ))}
        </ul>

        {!deleted && (
          <>
            <div className="border-t-2 border-dashed border-border" />
            <div className="flex justify-between text-[15px]">
              <span>รวมรายจ่าย</span>
              <span className="font-bold tabular-nums">{formatBaht(expense)}</span>
            </div>
            {income > 0 && (
              <div className="flex justify-between text-[15px]">
                <span>รวมรายรับ</span>
                <span className="font-bold tabular-nums">{formatBaht(income)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-[15px] font-semibold">สุทธิของวัน</span>
              <span className="text-2xl font-bold tabular-nums">{formatBaht(income - expense)}</span>
            </div>
          </>
        )}
      </div>
      <div className="receipt-zigzag" aria-hidden />
    </article>
  );
}
