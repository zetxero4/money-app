"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Category, type Transaction } from "@/lib/api";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

interface Props {
  tx: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function EditDialog(props: Props) {
  return (
    <Dialog open={props.tx !== null} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขรายการ</DialogTitle>
        </DialogHeader>
        {props.tx && <EditForm key={props.tx.id} {...props} tx={props.tx} />}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ tx, categories, onClose, onSaved, onDelete }: Props & { tx: Transaction }) {
  const [note, setNote] = useState(tx.note);
  const [amount, setAmount] = useState(String(tx.amount));
  const [categoryId, setCategoryId] = useState(tx.categoryId ?? "");
  const [date, setDate] = useState(tx.occurredOn);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const cat = categories.find((c) => c.id === categoryId);
      const updated = await api<Transaction>(`/api/transactions/${tx.id}`, {
        method: "PATCH",
        body: { note, amount, occurredOn: date, ...(cat ? { category: cat.id, kind: cat.kind } : {}) },
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="edit-note">ชื่อรายการ</Label>
        <Input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-amount">จำนวน (บาท)</Label>
          <Input id="edit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="edit-date">วันที่</Label>
          <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="edit-category">หมวด</Label>
        <select id="edit-category" className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <optgroup label="รายจ่าย">
            {categories
              .filter((c) => c.kind === "expense")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="รายรับ">
            {categories
              .filter((c) => c.kind === "income")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </optgroup>
        </select>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="ghost" className="text-destructive sm:mr-auto" onClick={() => onDelete(tx)}>
          ลบรายการ
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </DialogFooter>
    </form>
  );
}
