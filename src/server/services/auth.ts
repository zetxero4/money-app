// สมัคร / ล็อกอิน / session ของหน้าเว็บ
// บัญชีแรกที่สมัครเป็นเจ้าของ แล้วปิดรับสมัครทันที (ทำใน batch เดียว = transaction เดียวของ D1)

import { DEFAULT_CATEGORIES } from "../categories";
import { type Db, newId, nowIso } from "../db";

// Workers จำกัด PBKDF2 ไว้ไม่เกิน 100,000 รอบ
const PBKDF2_ITERATIONS = 100_000;
const SESSION_DAYS = 30;

export class AuthError extends Error {
  constructor(
    public code: "registration_closed" | "invalid_input" | "invalid_credentials",
    message: string,
  ) {
    super(message);
  }
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

function toB64Url(bytes: Uint8Array): string {
  return toB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, saltB64, hashB64] = stored.split("$");
  if (scheme !== "pbkdf2") return false;
  const expected = fromB64(hashB64);
  const actual = await pbkdf2(password, fromB64(saltB64), Number(iter));
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validate(email: string, password: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("invalid_input", "อีเมลไม่ถูกต้อง");
  if (password.length < 8) throw new AuthError("invalid_input", "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
}

export async function isRegistrationOpen(db: Db): Promise<boolean> {
  const row = await db.prepare("SELECT value FROM app_settings WHERE key = 'registration_open'").first<{ value: string }>();
  return row?.value === "1";
}

/** สมัครบัญชีเจ้าของ ได้ครั้งเดียว ครั้งต่อไปจะถูกปฏิเสธ */
export async function registerOwner(db: Db, emailInput: string, password: string): Promise<{ userId: string }> {
  const email = normalizeEmail(emailInput);
  validate(email, password);
  if (!(await isRegistrationOpen(db))) throw new AuthError("registration_closed", "ปิดรับสมัครแล้ว");

  const userId = newId();
  const now = nowIso();
  const passwordHash = await hashPassword(password);

  const statements = [
    // แทรกผู้ใช้เฉพาะเมื่อยังเปิดรับสมัคร (กันสองคนสมัครพร้อมกัน)
    db
      .prepare(
        `INSERT INTO users (id, email, password_hash, created_at)
         SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM app_settings WHERE key = 'registration_open' AND value = '1')`,
      )
      .bind(userId, email, passwordHash, now),
    db.prepare("UPDATE app_settings SET value = '0' WHERE key = 'registration_open'"),
    ...DEFAULT_CATEGORIES.map((c, i) =>
      db
        .prepare(
          `INSERT INTO categories (id, user_id, name, kind, icon, keywords, sort)
           SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`,
        )
        .bind(newId(), userId, c.name, c.kind, c.icon, c.keywords.join(","), i, userId),
    ),
  ];
  await db.batch(statements);

  const created = await db.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
  if (!created) throw new AuthError("registration_closed", "ปิดรับสมัครแล้ว");
  return { userId };
}

export async function login(db: Db, emailInput: string, password: string): Promise<{ userId: string }> {
  const email = normalizeEmail(emailInput);
  const user = await db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new AuthError("invalid_credentials", "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  return { userId: user.id };
}

export interface NewSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(db: Db, userId: string): Promise<NewSession> {
  const token = toB64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, expiresAt.toISOString(), nowIso())
    .run();
  return { token, expiresAt };
}

export async function getSessionUser(db: Db, token: string | undefined): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id AS user_id, u.email AS email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(await sha256Hex(token), nowIso())
    .first<{ user_id: string; email: string }>();
  return row ? { userId: row.user_id, email: row.email } : null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256Hex(token)).run();
}
