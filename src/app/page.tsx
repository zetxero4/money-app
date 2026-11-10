"use client";

import { useCallback, useEffect, useState } from "react";
import { CornerDownLeft, Pencil, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/money/app-shell";
import { CategoryIcon } from "@/components/money/category-icon";
import { EditDialog } from "@/components/money/edit-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, type Category, type Summary, type Transaction, formatBaht, formatThaiDate } from "@/lib/api";
import { cn } from "@/lib/utils";

function Home() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<Transaction[]>(`/api/transactions?limit=100${showDeleted ? "&deleted=1" : ""}`),
      api<Summary>("/api/summary?period=this_month"),
    ]).then(([list, sum]) => {
      if (!alive) return;
      setItems(list);
      setSummary(sum);
    });
    return () => {
      alive = false;
    };
  }, [showDeleted, version]);

  useEffect(() => {
    api<Category[]>("/api/categories").then(setCategories);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      const created = await api<Transaction[]>("/api/transactions", { method: "POST", body: { text } });
      setText("");
      toast.success(
        created.length === 1
          ? `บันทึก ${created[0].note || "รายการ"} ${formatBaht(created[0].amountSatang)} บาท → ${created[0].categoryName}`
          : `บันทึก ${created.length} รายการ`,
      );
      if (showDeleted) setShowDeleted(false);
      else reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(tx: Transaction) {
    await api(`/api/transactions/${tx.id}`, { method: "DELETE" });
    toast("ลบแล้ว", { action: { label: "เลิกทำ", onClick: () => restore(tx) } });
    reload();
  }

  async function restore(tx: Transaction) {
    await api(`/api/transactions/${tx.id}/restore`, { method: "POST" });
    toast.success("กู้คืนแล้ว");
    reload();
  }

  const groups = new Map<string, Transaction[]>();
  for (const t of items ?? []) groups.set(t.occurredOn, [...(groups.get(t.occurredOn) ?? []), t]);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <div className="relative">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="กะเพราไข่ดาว 65  กาแฟ 55"
            className="h-14 rounded-2xl pr-14 text-lg"
            autoFocus
            disabled={busy}
            aria-label="พิมพ์รายการแล้วกด Enter"
          />
          <Button type="submit" size="icon-lg" className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-xl" disabled={busy} aria-label="บันทึก">
            <CornerDownLeft />
          </Button>
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          พิมพ์ชื่อตามด้วยจำนวนเงิน หลายรายการในบรรทัดเดียวได้ · ขึ้นต้นด้วย &quot;เมื่อวาน&quot; ได้ · ระบบเดาหมวดให้
        </p>
      </form>

      {summary && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "รายจ่ายเดือนนี้", value: summary.current.expenseSatang, cls: "" },
            { label: "รายรับเดือนนี้", value: summary.current.incomeSatang, cls: "text-emerald-600 dark:text-emerald-400" },
            { label: "คงเหลือ", value: summary.current.netSatang, cls: summary.current.netSatang < 0 ? "text-destructive" : "" },
          ].map((s) => (
            <Card key={s.label} size="sm">
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={cn("mt-1 text-lg font-semibold tabular-nums sm:text-xl", s.cls)}>{formatBaht(s.value)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{showDeleted ? "รายการที่ลบแล้ว" : "รายการล่าสุด"}</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "กลับไปรายการปกติ" : <><Trash2 /> ที่ลบแล้ว</>}
          </Button>
        </div>

        {items === null ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {showDeleted ? "ไม่มีรายการที่ลบ" : "ยังไม่มีรายการ ลองพิมพ์ด้านบน หรือบอก Claude ก็ได้"}
          </p>
        ) : (
          [...groups.entries()].map(([date, txs]) => (
            <div key={date} className="space-y-1">
              <p className="px-1 text-xs font-medium text-muted-foreground">{formatThaiDate(date)}</p>
              <ul className="divide-y rounded-xl border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <CategoryIcon name={t.categoryIcon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.note || t.categoryName || "ไม่มีชื่อ"}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {t.categoryName}
                        {t.source === "claude" && (
                          <Badge variant="secondary" className="h-4 gap-0.5 px-1.5 text-[10px]">
                            <Sparkles className="size-2.5" /> จาก Claude
                          </Badge>
                        )}
                      </p>
                    </div>
                    <p className={cn("text-sm font-semibold tabular-nums", t.kind === "income" && "text-emerald-600 dark:text-emerald-400")}>
                      {t.kind === "income" ? "+" : "-"}{formatBaht(t.amountSatang)}
                    </p>
                    {showDeleted ? (
                      <Button variant="ghost" size="icon-sm" onClick={() => restore(t)} aria-label="กู้คืน">
                        <RotateCcw />
                      </Button>
                    ) : (
                      <div className="flex">
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(t)} aria-label="แก้ไข">
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => remove(t)} aria-label="ลบ">
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <EditDialog
        tx={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast.success("แก้ไขแล้ว");
          reload();
        }}
      />
    </div>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}
