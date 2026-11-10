// service layer: หน้าเว็บ (API) และ MCP เรียกฟังก์ชันชุดนี้ชุดเดียวกัน

import { guessCategory, guessKind, type Kind } from "../categories";
import { type Db, newId, nowIso } from "../db";
import { satangToBaht } from "../money";
import { type DateRange, isIsoDate, previousRange, todayInBangkok } from "../thai-date";

export type Source = "web" | "claude";

export class ServiceError extends Error {
  constructor(
    public code: "not_found" | "invalid_input",
    message: string,
  ) {
    super(message);
  }
}

export interface Category {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
  keywords: string;
  sort: number;
}

export interface Transaction {
  id: string;
  kind: Kind;
  amountSatang: number;
  amount: number; // บาท
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  note: string;
  occurredOn: string;
  source: Source;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface TxRow {
  id: string;
  kind: Kind;
  amount_satang: number;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  note: string;
  occurred_on: string;
  source: Source;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const SELECT_TX = `SELECT t.id, t.kind, t.amount_satang, t.category_id, c.name AS category_name, c.icon AS category_icon,
  t.note, t.occurred_on, t.source, t.created_at, t.updated_at, t.deleted_at
  FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;

function toTx(r: TxRow): Transaction {
  return {
    id: r.id,
    kind: r.kind,
    amountSatang: r.amount_satang,
    amount: satangToBaht(r.amount_satang),
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryIcon: r.category_icon,
    note: r.note,
    occurredOn: r.occurred_on,
    source: r.source,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
  };
}

export async function listCategories(db: Db, userId: string): Promise<Category[]> {
  const { results } = await db
    .prepare("SELECT id, name, kind, icon, keywords, sort FROM categories WHERE user_id = ? ORDER BY sort, name")
    .bind(userId)
    .all<Category>();
  return results;
}

function findCategory(categories: Category[], ref: string | undefined, kind?: Kind): Category | undefined {
  if (!ref) return undefined;
  const key = ref.trim().toLowerCase();
  const pool = kind ? categories.filter((c) => c.kind === kind) : categories;
  return pool.find((c) => c.id === ref) ?? pool.find((c) => c.name.toLowerCase() === key);
}

async function getTx(db: Db, userId: string, id: string): Promise<Transaction> {
  const row = await db.prepare(`${SELECT_TX} WHERE t.id = ? AND t.user_id = ?`).bind(id, userId).first<TxRow>();
  if (!row) throw new ServiceError("not_found", "ไม่พบรายการนี้");
  return toTx(row);
}

export interface NewTransaction {
  note: string;
  amountSatang: number;
  kind?: Kind;
  category?: string; // id หรือชื่อหมวด ถ้าไม่ระบุจะเดาจากโน้ต
  occurredOn?: string; // YYYY-MM-DD ถ้าไม่ระบุใช้วันนี้ตามเวลาไทย
}

export async function addTransactions(db: Db, userId: string, items: NewTransaction[], source: Source): Promise<Transaction[]> {
  if (items.length === 0) throw new ServiceError("invalid_input", "ไม่มีรายการให้บันทึก");
  if (items.length > 50) throw new ServiceError("invalid_input", "บันทึกได้ครั้งละไม่เกิน 50 รายการ");
  const categories = await listCategories(db, userId);
  const today = todayInBangkok();
  const now = nowIso();
  const ids: string[] = [];

  const statements = items.map((item) => {
    if (!Number.isSafeInteger(item.amountSatang) || item.amountSatang <= 0) {
      throw new ServiceError("invalid_input", "จำนวนเงินต้องมากกว่า 0");
    }
    const occurredOn = item.occurredOn ?? today;
    if (!isIsoDate(occurredOn)) throw new ServiceError("invalid_input", `วันที่ไม่ถูกต้อง: ${occurredOn}`);
    const note = (item.note ?? "").trim().slice(0, 200);
    const named = findCategory(categories, item.category, item.kind);
    if (item.category && !named) throw new ServiceError("invalid_input", `ไม่พบหมวด "${item.category}"`);
    const kind: Kind = item.kind ?? named?.kind ?? guessKind(note);
    const category = named ?? guessCategory(note, kind, categories);
    const id = newId();
    ids.push(id);
    return db
      .prepare(
        `INSERT INTO transactions (id, user_id, kind, amount_satang, category_id, note, occurred_on, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, userId, kind, item.amountSatang, category?.id ?? null, note, occurredOn, source, now, now);
  });
  await db.batch(statements);
  return Promise.all(ids.map((id) => getTx(db, userId, id)));
}

export interface ListFilter {
  from?: string;
  to?: string;
  category?: string;
  kind?: Kind;
  query?: string;
  deleted?: boolean; // true = แสดงเฉพาะที่ลบแล้ว
  limit?: number;
}

export async function listTransactions(db: Db, userId: string, filter: ListFilter = {}): Promise<Transaction[]> {
  const where = ["t.user_id = ?", filter.deleted ? "t.deleted_at IS NOT NULL" : "t.deleted_at IS NULL"];
  const params: unknown[] = [userId];
  if (filter.from) {
    if (!isIsoDate(filter.from)) throw new ServiceError("invalid_input", "วันที่เริ่มไม่ถูกต้อง");
    where.push("t.occurred_on >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    if (!isIsoDate(filter.to)) throw new ServiceError("invalid_input", "วันที่สิ้นสุดไม่ถูกต้อง");
    where.push("t.occurred_on <= ?");
    params.push(filter.to);
  }
  if (filter.kind) {
    where.push("t.kind = ?");
    params.push(filter.kind);
  }
  if (filter.category) {
    const cat = findCategory(await listCategories(db, userId), filter.category);
    if (!cat) throw new ServiceError("invalid_input", `ไม่พบหมวด "${filter.category}"`);
    where.push("t.category_id = ?");
    params.push(cat.id);
  }
  if (filter.query) {
    where.push("t.note LIKE ? ESCAPE '\\'");
    params.push(`%${filter.query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 500);
  const { results } = await db
    .prepare(`${SELECT_TX} WHERE ${where.join(" AND ")} ORDER BY t.occurred_on DESC, t.created_at DESC LIMIT ${limit}`)
    .bind(...params)
    .all<TxRow>();
  return results.map(toTx);
}

export interface TransactionPatch {
  note?: string;
  amountSatang?: number;
  kind?: Kind;
  category?: string;
  occurredOn?: string;
}

export async function updateTransaction(db: Db, userId: string, id: string, patch: TransactionPatch): Promise<Transaction> {
  const current = await getTx(db, userId, id);
  if (current.deletedAt) throw new ServiceError("invalid_input", "รายการนี้ถูกลบแล้ว กู้คืนก่อนแก้ไข");
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.amountSatang !== undefined) {
    if (!Number.isSafeInteger(patch.amountSatang) || patch.amountSatang <= 0) {
      throw new ServiceError("invalid_input", "จำนวนเงินต้องมากกว่า 0");
    }
    sets.push("amount_satang = ?");
    params.push(patch.amountSatang);
  }
  if (patch.note !== undefined) {
    sets.push("note = ?");
    params.push(patch.note.trim().slice(0, 200));
  }
  if (patch.occurredOn !== undefined) {
    if (!isIsoDate(patch.occurredOn)) throw new ServiceError("invalid_input", "วันที่ไม่ถูกต้อง");
    sets.push("occurred_on = ?");
    params.push(patch.occurredOn);
  }
  if (patch.category !== undefined || patch.kind !== undefined) {
    const categories = await listCategories(db, userId);
    const cat = patch.category ? findCategory(categories, patch.category, patch.kind) : undefined;
    if (patch.category && !cat) throw new ServiceError("invalid_input", `ไม่พบหมวด "${patch.category}"`);
    const kind = patch.kind ?? cat?.kind ?? current.kind;
    const finalCat = cat ?? (kind !== current.kind ? guessCategory(patch.note ?? current.note, kind, categories) : undefined);
    sets.push("kind = ?");
    params.push(kind);
    if (finalCat) {
      sets.push("category_id = ?");
      params.push(finalCat.id);
    }
  }
  if (sets.length === 0) return current;
  sets.push("updated_at = ?");
  params.push(nowIso());
  await db
    .prepare(`UPDATE transactions SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .bind(...params, id, userId)
    .run();
  return getTx(db, userId, id);
}

export async function deleteTransaction(db: Db, userId: string, id: string): Promise<Transaction> {
  await getTx(db, userId, id);
  const now = nowIso();
  await db
    .prepare("UPDATE transactions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL")
    .bind(now, now, id, userId)
    .run();
  return getTx(db, userId, id);
}

export async function restoreTransaction(db: Db, userId: string, id: string): Promise<Transaction> {
  await getTx(db, userId, id);
  await db
    .prepare("UPDATE transactions SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(nowIso(), id, userId)
    .run();
  return getTx(db, userId, id);
}

export interface CategoryTotal {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  kind: Kind;
  totalSatang: number;
  total: number;
  count: number;
}

export interface Totals {
  from: string;
  to: string;
  incomeSatang: number;
  expenseSatang: number;
  netSatang: number;
  income: number;
  expense: number;
  net: number;
  count: number;
  byCategory: CategoryTotal[];
}

async function totalsFor(db: Db, userId: string, range: DateRange): Promise<Totals> {
  const { results } = await db
    .prepare(
      `SELECT t.kind AS kind, t.category_id AS category_id, c.name AS category_name, c.icon AS icon,
              SUM(t.amount_satang) AS total, COUNT(*) AS count
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.deleted_at IS NULL AND t.occurred_on >= ? AND t.occurred_on <= ?
       GROUP BY t.kind, t.category_id ORDER BY total DESC`,
    )
    .bind(userId, range.from, range.to)
    .all<{ kind: Kind; category_id: string | null; category_name: string | null; icon: string | null; total: number; count: number }>();

  let income = 0;
  let expense = 0;
  let count = 0;
  const byCategory = results.map((r) => {
    if (r.kind === "income") income += r.total;
    else expense += r.total;
    count += r.count;
    return {
      categoryId: r.category_id,
      categoryName: r.category_name ?? "ไม่มีหมวด",
      icon: r.icon,
      kind: r.kind,
      totalSatang: r.total,
      total: satangToBaht(r.total),
      count: r.count,
    };
  });
  return {
    from: range.from,
    to: range.to,
    incomeSatang: income,
    expenseSatang: expense,
    netSatang: income - expense,
    income: satangToBaht(income),
    expense: satangToBaht(expense),
    net: satangToBaht(income - expense),
    count,
    byCategory,
  };
}

export interface Summary {
  current: Totals;
  previous: Totals;
  /** เปลี่ยนแปลงของรายจ่ายแต่ละหมวดเทียบช่วงก่อน (บาท) */
  expenseChangeByCategory: Array<{ categoryName: string; current: number; previous: number; change: number }>;
}

export async function getSummary(db: Db, userId: string, range: DateRange): Promise<Summary> {
  if (!isIsoDate(range.from) || !isIsoDate(range.to) || range.from > range.to) {
    throw new ServiceError("invalid_input", "ช่วงวันที่ไม่ถูกต้อง");
  }
  const prevRange = previousRange(range);
  const [current, previous] = await Promise.all([totalsFor(db, userId, range), totalsFor(db, userId, prevRange)]);

  const names = new Set<string>();
  for (const c of [...current.byCategory, ...previous.byCategory]) if (c.kind === "expense") names.add(c.categoryName);
  const pick = (t: Totals, name: string) =>
    t.byCategory.find((c) => c.kind === "expense" && c.categoryName === name)?.totalSatang ?? 0;
  const expenseChangeByCategory = [...names]
    .map((name) => {
      const cur = pick(current, name);
      const prev = pick(previous, name);
      return { categoryName: name, current: satangToBaht(cur), previous: satangToBaht(prev), change: satangToBaht(cur - prev) };
    })
    .sort((a, b) => b.current - a.current);

  return { current, previous, expenseChangeByCategory };
}
