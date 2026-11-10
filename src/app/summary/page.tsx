"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { AppShell } from "@/components/money/app-shell";
import { CategoryIcon } from "@/components/money/category-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, type Summary as SummaryData, formatBaht, formatThaiDate } from "@/lib/api";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "this_week", label: "สัปดาห์นี้" },
  { value: "this_month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนที่แล้ว" },
  { value: "this_year", label: "ปีนี้" },
];

function Change({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous;
  if (diff === 0) return <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="size-3" /> เท่าเดิม</span>;
  const pct = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
  const up = diff > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs", up ? "text-destructive" : "text-brand")}>
      {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {formatBaht(Math.abs(diff))}
      {pct !== null && ` (${pct}%)`}
    </span>
  );
}

function SummaryView() {
  const [period, setPeriod] = useState("this_month");
  const [loaded, setLoaded] = useState<{ period: string; data: SummaryData } | null>(null);
  const data = loaded?.period === period ? loaded.data : null;

  useEffect(() => {
    let alive = true;
    api<SummaryData>(`/api/summary?period=${period}`).then((d) => alive && setLoaded({ period, data: d }));
    return () => {
      alive = false;
    };
  }, [period]);

  const expenses = data?.current.byCategory.filter((c) => c.kind === "expense") ?? [];
  const incomes = data?.current.byCategory.filter((c) => c.kind === "income") ?? [];
  const maxExpense = Math.max(1, ...expenses.map((c) => c.totalSatang));
  const prevOf = (name: string) =>
    data?.previous.byCategory.find((c) => c.kind === "expense" && c.categoryName === name)?.totalSatang ?? 0;

  return (
    <div className="space-y-5">
      <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
        <TabsList className="w-full">
          {PERIODS.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="flex-1">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!data ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {formatThaiDate(data.current.from)} – {formatThaiDate(data.current.to)} · เทียบกับ {formatThaiDate(data.previous.from)} –{" "}
            {formatThaiDate(data.previous.to)}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground">รายจ่าย</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBaht(data.current.expenseSatang)}</p>
                <Change current={data.current.expenseSatang} previous={data.previous.expenseSatang} />
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground">รายรับ</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-brand">
                  {formatBaht(data.current.incomeSatang)}
                </p>
                <p className="text-xs text-muted-foreground">ช่วงก่อน {formatBaht(data.previous.incomeSatang)}</p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground">คงเหลือ</p>
                <p className={cn("mt-1 text-2xl font-semibold tabular-nums", data.current.netSatang < 0 && "text-destructive")}>
                  {formatBaht(data.current.netSatang)}
                </p>
                <p className="text-xs text-muted-foreground">{data.current.count} รายการ</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>เงินหายไปไหน</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {expenses.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีรายจ่ายในช่วงนี้</p>}
              {expenses.map((c) => (
                <div key={c.categoryName} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm">
                    <CategoryIcon name={c.icon} className="size-4 text-muted-foreground" />
                    <span className="flex-1">{c.categoryName}</span>
                    <span className="font-medium tabular-nums">{formatBaht(c.totalSatang)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.totalSatang / maxExpense) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {c.count} รายการ · {Math.round((c.totalSatang / Math.max(1, data.current.expenseSatang)) * 100)}% ของรายจ่าย
                    </span>
                    <Change current={c.totalSatang} previous={prevOf(c.categoryName)} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {incomes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>รายรับ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {incomes.map((c) => (
                  <div key={c.categoryName} className="flex items-center gap-2 text-sm">
                    <CategoryIcon name={c.icon} className="size-4 text-muted-foreground" />
                    <span className="flex-1">{c.categoryName}</span>
                    <span className="font-medium tabular-nums text-brand">{formatBaht(c.totalSatang)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <AppShell>
      <SummaryView />
    </AppShell>
  );
}
