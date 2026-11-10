"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/money/app-shell";
import { CategoryTiles } from "@/components/money/category-tiles";
import { DayReceipt } from "@/components/money/day-receipt";
import { EditDialog } from "@/components/money/edit-dialog";
import { HomeHero } from "@/components/money/home-hero";
import { Button } from "@/components/ui/button";
import { api, type Category, type Summary, type Transaction, formatBaht } from "@/lib/api";

const LIST_LIMIT = 200;

function Home() {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("this_month");
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    api<Transaction[]>(`/api/transactions?limit=${LIST_LIMIT}${showDeleted ? "&deleted=1" : ""}`).then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [showDeleted, version]);

  useEffect(() => {
    let alive = true;
    api<Summary>(`/api/summary?period=${period}`).then((s) => {
      if (alive) setSummary(s);
    });
    return () => {
      alive = false;
    };
  }, [period, version]);

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
      setShowDeleted(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function remove(tx: Transaction) {
    await api(`/api/transactions/${tx.id}`, { method: "DELETE" });
    setEditing(null);
    toast("ลบแล้ว", { action: { label: "เลิกทำ", onClick: () => restore(tx) } });
    reload();
  }

  async function restore(tx: Transaction) {
    await api(`/api/transactions/${tx.id}/restore`, { method: "POST" });
    toast.success("กู้คืนแล้ว");
    reload();
  }

  const days = new Map<string, Transaction[]>();
  for (const t of items ?? []) days.set(t.occurredOn, [...(days.get(t.occurredOn) ?? []), t]);
  // ถ้ารายการถึงขีดจำกัด วันเก่าสุดอาจแสดงไม่ครบ: ซ่อนวันนั้นไว้แทนที่จะแสดงยอดผิด
  const dayEntries = [...days.entries()];
  if (items && items.length >= LIST_LIMIT && dayEntries.length > 1) dayEntries.pop();

  return (
    <div className="space-y-7 pb-24">
      <HomeHero period={period} onPeriod={setPeriod} summary={summary} />
      <CategoryTiles summary={summary} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{showDeleted ? "รายการที่ลบแล้ว" : "ใบเสร็จรายวัน"}</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowDeleted((v) => !v)}>
            {showDeleted ? "กลับไปใบเสร็จ" : "ที่ลบแล้ว"}
          </Button>
        </div>
        <div className="rounded-3xl bg-surface-alt p-4 sm:p-5">
          {items === null ? (
            <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
          ) : dayEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {showDeleted ? "ไม่มีรายการที่ลบ" : "ยังไม่มีรายการ ลองพิมพ์ช่องด้านล่าง หรือบอก Claude ก็ได้"}
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {dayEntries.map(([date, txs]) => (
                <DayReceipt key={date} date={date} items={txs} deleted={showDeleted} onEdit={setEditing} onRestore={restore} />
              ))}
            </div>
          )}
        </div>
        {!showDeleted && <p className="px-1 text-xs text-muted-foreground">แตะรายการเพื่อแก้ไขหรือลบ</p>}
      </section>

      {/* แบบ C: ช่องพิมพ์ลอยด้านล่าง (บนมือถืออยู่เหนือแถบเมนู) */}
      <form
        onSubmit={submit}
        className="fixed inset-x-4 bottom-[76px] z-10 mx-auto flex max-w-[640px] items-center gap-2 rounded-full bg-background py-1.5 pr-1.5 pl-5 shadow-[0_6px_24px_rgb(12_0_179/0.18)] sm:bottom-6"
      >
        <label htmlFor="entry" className="sr-only">
          พิมพ์รายการแล้วกด Enter
        </label>
        <input
          id="entry"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ข้าวมันไก่ 60 กาแฟ 55"
          autoComplete="off"
          disabled={busy}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={busy}
          aria-label="บันทึก"
          className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-[#1446d6] disabled:opacity-50"
        >
          <Plus className="size-[22px]" strokeWidth={2.5} />
        </button>
      </form>

      <EditDialog
        tx={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onDelete={remove}
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
