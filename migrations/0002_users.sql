-- 0002: Akaun pengguna + sesi log masuk (admin / staff)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  position TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  password_hash TEXT NOT NULL,
  -- Kod QR log masuk kekal — hanya hash SHA-256 disimpan
  qr_token_hash TEXT UNIQUE,
  created_at TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- Siapa yang merekod penggunaan (untuk dashboard staff)
ALTER TABLE usages ADD COLUMN recorded_by TEXT;
