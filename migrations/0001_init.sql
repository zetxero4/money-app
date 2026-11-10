-- ผู้ใช้ (แอปนี้ใช้คนเดียว: บัญชีแรกที่สมัครเป็นเจ้าของ)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- SHA-256 ของ token ในคุกกี้ (ไม่เก็บ token ตรงๆ)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  icon TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',   -- คั่นด้วย , ใช้เดาหมวด
  sort INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, name)
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
  amount_satang INTEGER NOT NULL CHECK (amount_satang > 0),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,           -- YYYY-MM-DD ตามเวลาไทย
  source TEXT NOT NULL CHECK (source IN ('web', 'claude')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT                      -- ไม่ใช่ NULL = ลบแล้ว (กู้คืนได้)
);
CREATE INDEX transactions_user_date ON transactions(user_id, occurred_on);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO app_settings (key, value) VALUES ('registration_open', '1');
