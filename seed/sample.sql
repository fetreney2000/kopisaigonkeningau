-- 0002_sample.sql — Data contoh (OPTIONAL). Jalankan hanya jika anda mahu lihat aplikasi
-- dengan data contoh dahulu: wrangler d1 execute saigon-inventory --local --file=./migrations/0002_sample.sql

INSERT INTO items (id, name, category, unit, source, unit_cost, min_qty, note, created_at) VALUES
  ('SG-ESP0001', 'Biji Kopi Espresso', 'Kopi', 'kg', 'franchisor', 48.00, 3, 'Stok kopi utama', '2026-11-01T09:00:00Z'),
  ('SG-ESP0002', 'Sirap Pandan', 'Sirap', 'botol', 'franchisor', 9.50, 6, '', '2026-11-01T09:00:00Z'),
  ('SG-ESP0003', 'Susu UHT Penuh Krim', 'Susu', 'karton', 'franchisor', 6.80, 12, '', '2026-11-01T09:00:00Z'),
  ('SG-LOC0001', 'Gula Pepat', 'Pemanis', 'kg', 'local', 3.20, 5, 'Belik kedai runcit Sejahtera', '2026-11-01T09:00:00Z'),
  ('SG-LOC0002', 'Cawan Kertas 8oz', 'Bungkusan', 'tiub', 'local', 4.50, 4, '', '2026-11-01T09:00:00Z'),
  ('SG-LOC0003', 'Tisu Lipat', 'Lain-lain', 'pakej', 'local', 2.10, 3, '', '2026-11-01T09:00:00Z');

INSERT INTO purchases (id, item_id, qty, unit_cost, date, note, created_at) VALUES
  ('PC-0001', 'SG-ESP0001', 10, 48.00, '2026-11-02', 'Pesanan mingguan francais', '2026-11-02T08:00:00Z'),
  ('PC-0002', 'SG-ESP0003', 24, 6.80, '2026-11-02', '', '2026-11-02T08:00:00Z'),
  ('PC-0003', 'SG-LOC0001', 8, 3.20, '2026-11-04', 'Kedai runcit Sejahtera', '2026-11-04T10:30:00Z'),
  ('PC-0004', 'SG-LOC0002', 15, 4.50, '2026-11-04', '', '2026-11-04T10:30:00Z'),
  ('PC-0005', 'SG-ESP0002', 12, 9.50, '2026-11-06', '', '2026-11-06T09:15:00Z'),
  ('PC-0006', 'SG-LOC0003', 10, 2.10, '2026-11-07', '', '2026-11-07T14:00:00Z');

INSERT INTO usages (id, item_id, qty, date, method, note, created_at) VALUES
  ('US-0001', 'SG-ESP0001', 1.8, '2026-11-05', 'manual', '', '2026-11-05T20:00:00Z'),
  ('US-0002', 'SG-ESP0001', 2.1, '2026-11-09', 'manual', '', '2026-11-09T20:00:00Z'),
  ('US-0003', 'SG-ESP0001', 1.6, '2026-11-12', 'manual', '', '2026-11-12T20:00:00Z'),
  ('US-0004', 'SG-ESP0003', 9, '2026-11-10', 'scan', '', '2026-11-10T20:00:00Z'),
  ('US-0005', 'SG-LOC0001', 3, '2026-11-10', 'manual', '', '2026-11-10T20:00:00Z'),
  ('US-0006', 'SG-ESP0002', 5, '2026-11-11', 'scan', '', '2026-11-11T20:00:00Z'),
  ('US-0007', 'SG-LOC0002', 6, '2026-11-11', 'scan', '', '2026-11-11T20:00:00Z');

INSERT INTO adjustments (id, item_id, delta, date, reason, created_at) VALUES
  ('AD-0001', 'SG-LOC0003', -1, '2026-11-10', 'Cawan rosak — kiraan fizikal', '2026-11-10T18:00:00Z');
