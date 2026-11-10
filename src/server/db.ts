// ชนิดข้อมูลขั้นต่ำของ D1 ที่ service layer ใช้ (ทำให้เทสต์ด้วย SQLite ในเครื่องได้)

export interface DbResult<T> {
  results: T[];
}

export interface DbRunResult {
  meta: { changes: number };
}

export interface DbStatement {
  bind(...values: unknown[]): DbStatement;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<DbRunResult>;
}

export interface Db {
  prepare(sql: string): DbStatement;
  batch(statements: DbStatement[]): Promise<unknown[]>;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
