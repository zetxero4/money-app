// ตัวแปลง better-sqlite3 ให้หน้าตาเหมือน D1 เพื่อใช้ในเทสต์
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Db, DbStatement } from "../src/server/db";

class Stmt implements DbStatement {
  constructor(private sqlite: Database.Database, private sql: string, private params: unknown[] = []) {}
  bind(...values: unknown[]) { return new Stmt(this.sqlite, this.sql, values); }
  async all<T>() { return { results: this.sqlite.prepare(this.sql).all(...(this.params as never[])) as T[] }; }
  async first<T>() { return (this.sqlite.prepare(this.sql).get(...(this.params as never[])) as T) ?? null; }
  async run() { const r = this.sqlite.prepare(this.sql).run(...(this.params as never[])); return { meta: { changes: r.changes } }; }
  runSync() { return this.sqlite.prepare(this.sql).run(...(this.params as never[])); }
}

export function createTestDb(): Db {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const dir = join(__dirname, "..", "migrations");
  for (const f of readdirSync(dir).sort()) sqlite.exec(readFileSync(join(dir, f), "utf8"));
  return {
    prepare: (sql) => new Stmt(sqlite, sql),
    // D1 batch = transaction: ถ้าคำสั่งใดพัง ย้อนกลับทั้งหมด
    batch: async (stmts) => sqlite.transaction(() => stmts.map((s) => (s as Stmt).runSync()))(),
  };
}
