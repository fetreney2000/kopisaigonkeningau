-- 0001_init.sql — Skema pangkalan data Saigon Inventori
CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,                 -- Kod item (juga kandungan kod QR), cth: SG-K7X2QP4M
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT '',
  unit        TEXT NOT NULL DEFAULT 'unit',
  source      TEXT NOT NULL CHECK (source IN ('franchisor','local')),
  unit_cost   REAL NOT NULL DEFAULT 0,
  min_qty     REAL NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id),
  qty         REAL NOT NULL,
  unit_cost   REAL NOT NULL,
  date        TEXT NOT NULL,                    -- YYYY-MM-DD
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_purchases_item ON purchases(item_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);

CREATE TABLE IF NOT EXISTS usages (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id),
  qty         REAL NOT NULL,
  date        TEXT NOT NULL,                    -- YYYY-MM-DD
  method      TEXT NOT NULL DEFAULT 'manual' CHECK (method IN ('scan','manual')),
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usages_item ON usages(item_id);
CREATE INDEX IF NOT EXISTS idx_usages_date ON usages(date);

CREATE TABLE IF NOT EXISTS adjustments (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL REFERENCES items(id),
  delta       REAL NOT NULL,                    -- positif / negatif
  date        TEXT NOT NULL,                    -- YYYY-MM-DD
  reason      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_item ON adjustments(item_id);
