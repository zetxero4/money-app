import { describe, expect, it } from "vitest";
import { createTestDb } from "./sqlite-db";
import { AuthError, createSession, deleteSession, getSessionUser, isRegistrationOpen, login, registerOwner } from "../src/server/services/auth";
import {
  addTransactions, deleteTransaction, getSummary, listCategories, listTransactions, restoreTransaction, updateTransaction,
} from "../src/server/services/transactions";
import { todayInBangkok } from "../src/server/thai-date";

async function setup() {
  const db = createTestDb();
  const { userId } = await registerOwner(db, "Owner@Example.com", "password123");
  return { db, userId };
}

describe("auth", () => {
  it("บัญชีแรกเป็นเจ้าของ แล้วปิดรับสมัคร", async () => {
    const { db } = await setup();
    expect(await isRegistrationOpen(db)).toBe(false);
    await expect(registerOwner(db, "other@example.com", "password123")).rejects.toMatchObject({ code: "registration_closed" });
  });
  it("สร้างหมวดเริ่มต้นให้", async () => {
    const { db, userId } = await setup();
    const cats = await listCategories(db, userId);
    expect(cats.map((c) => c.name)).toContain("อาหาร");
    expect(cats.filter((c) => c.kind === "income").length).toBeGreaterThan(0);
  });
  it("ล็อกอินและ session", async () => {
    const { db, userId } = await setup();
    expect((await login(db, "owner@example.com", "password123")).userId).toBe(userId);
    await expect(login(db, "owner@example.com", "wrong-pass")).rejects.toBeInstanceOf(AuthError);
    const s = await createSession(db, userId);
    expect((await getSessionUser(db, s.token))?.userId).toBe(userId);
    expect(await getSessionUser(db, "fake-token")).toBeNull();
    await deleteSession(db, s.token);
    expect(await getSessionUser(db, s.token)).toBeNull();
  });
  it("ตรวจรหัสผ่านสั้น", async () => {
    const db = createTestDb();
    await expect(registerOwner(db, "a@b.co", "short")).rejects.toMatchObject({ code: "invalid_input" });
    expect(await isRegistrationOpen(db)).toBe(true);
  });
});

describe("transactions", () => {
  it("เดาหมวดและบันทึกที่มา", async () => {
    const { db, userId } = await setup();
    const [rice, coffee, salary] = await addTransactions(db, userId, [
      { note: "ข้าวมันไก่", amountSatang: 6000 },
      { note: "กาแฟ", amountSatang: 5500 },
      { note: "เงินเดือนเข้า", amountSatang: 2_800_000 },
    ], "claude");
    expect(rice.categoryName).toBe("อาหาร");
    expect(coffee.categoryName).toBe("เครื่องดื่ม/กาแฟ");
    expect(salary).toMatchObject({ kind: "income", categoryName: "เงินเดือน", amount: 28000, source: "claude" });
    expect(rice.occurredOn).toBe(todayInBangkok());
  });
  it("ระบุหมวดที่ไม่มีอยู่ = error", async () => {
    const { db, userId } = await setup();
    await expect(addTransactions(db, userId, [{ note: "x", amountSatang: 100, category: "ไม่มีหมวดนี้" }], "web"))
      .rejects.toMatchObject({ code: "invalid_input" });
  });
  it("แก้ ลบ กู้คืน", async () => {
    const { db, userId } = await setup();
    const [t] = await addTransactions(db, userId, [{ note: "ข้าวมันไก่", amountSatang: 6000 }], "web");
    const updated = await updateTransaction(db, userId, t.id, { amountSatang: 6500 });
    expect(updated.amount).toBe(65);
    await deleteTransaction(db, userId, t.id);
    expect(await listTransactions(db, userId)).toHaveLength(0);
    expect(await listTransactions(db, userId, { deleted: true })).toHaveLength(1);
    await expect(updateTransaction(db, userId, t.id, { note: "x" })).rejects.toMatchObject({ code: "invalid_input" });
    await restoreTransaction(db, userId, t.id);
    expect(await listTransactions(db, userId)).toHaveLength(1);
  });
  it("ผู้ใช้อื่นเข้าถึงรายการไม่ได้", async () => {
    const { db, userId } = await setup();
    const [t] = await addTransactions(db, userId, [{ note: "กาแฟ", amountSatang: 5500 }], "web");
    await expect(deleteTransaction(db, "someone-else", t.id)).rejects.toMatchObject({ code: "not_found" });
  });
  it("ค้นหาด้วยคำ", async () => {
    const { db, userId } = await setup();
    await addTransactions(db, userId, [{ note: "กาแฟ", amountSatang: 5500 }, { note: "ข้าว", amountSatang: 5000 }], "web");
    expect((await listTransactions(db, userId, { query: "กาแฟ" })).map((t) => t.note)).toEqual(["กาแฟ"]);
    expect(await listTransactions(db, userId, { query: "%" })).toHaveLength(0);
  });
  it("สรุปแยกหมวดและเทียบช่วงก่อน", async () => {
    const { db, userId } = await setup();
    await addTransactions(db, userId, [
      { note: "กาแฟ", amountSatang: 5500, occurredOn: "2026-10-05" },
      { note: "กาแฟ", amountSatang: 4500, occurredOn: "2026-10-20" },
      { note: "ข้าว", amountSatang: 6000, occurredOn: "2026-10-20" },
      { note: "กาแฟ", amountSatang: 3000, occurredOn: "2026-09-10" },
      { note: "เงินเดือน", amountSatang: 2_800_000, occurredOn: "2026-10-25" },
    ], "web");
    const s = await getSummary(db, userId, { from: "2026-10-01", to: "2026-10-31" });
    expect(s.current).toMatchObject({ expense: 160, income: 28000, net: 27840, count: 4 });
    expect(s.previous).toMatchObject({ from: "2026-09-01", to: "2026-09-30", expense: 30 });
    expect(s.expenseChangeByCategory[0]).toEqual({ categoryName: "เครื่องดื่ม/กาแฟ", current: 100, previous: 30, change: 70 });
  });
});

describe("เดาหมวด", () => {
  it("ชาไข่มุก = เครื่องดื่ม ไม่ใช่อาหาร", async () => {
    const { db, userId } = await setup();
    const [t] = await addTransactions(db, userId, [{ note: "ชาไข่มุก", amountSatang: 4500 }], "web");
    expect(t.categoryName).toBe("เครื่องดื่ม/กาแฟ");
  });
});
