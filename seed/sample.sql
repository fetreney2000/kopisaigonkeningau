-- seed/sample.sql - Data contoh (OPTIONAL). Jalankan hanya jika anda mahu lihat aplikasi
-- dengan data contoh dahulu: wrangler d1 execute saigon-inventory --local --file=./seed/sample.sql
-- Nota: kod item mesti format SG- + 8 aksara dari A-Z2-9 (tanpa I/O/0/1) supaya boleh diimbas.

INSERT INTO items (id, name, category, unit, source, unit_cost, min_qty, note, created_at) VALUES
  ('SG-ESPK2PQA', 'Biji Kopi Espresso', 'Kopi', 'kg', 'franchisor', 48.00, 3, 'Stok kopi utama', '2026-11-01T09:00:00Z'),
  ('SG-SRP2PNDN', 'Sirap Pandan', 'Sirap', 'botol', 'franchisor', 9.50, 6, '', '2026-11-01T09:00:00Z'),
  ('SG-SUS2UHTK', 'Susu UHT Penuh Krim', 'Susu', 'karton', 'franchisor', 6.80, 12, '', '2026-11-01T09:00:00Z'),
  ('SG-GUL2PPTS', 'Gula Pepat', 'Pemanis', 'kg', 'local', 3.20, 5, 'Belik kedai runcit Sejahtera', '2026-11-01T09:00:00Z'),
  ('SG-CWN2KRTS', 'Cawan Kertas 8oz', 'Bungkusan', 'tiub', 'local', 4.50, 4, '', '2026-11-01T09:00:00Z'),
  ('SG-TSU2LPTS', 'Tisu Lipat', 'Lain-lain', 'pakej', 'local', 2.10, 3, '', '2026-11-01T09:00:00Z');

INSERT INTO purchases (id, item_id, qty, unit_cost, date, note, created_at) VALUES
  ('PC-0001', 'SG-ESPK2PQA', 10, 48.00, '2026-11-02', 'Pesanan mingguan francais', '2026-11-02T08:00:00Z'),
  ('PC-0002', 'SG-SUS2UHTK', 24, 6.80, '2026-11-02', '', '2026-11-02T08:00:00Z'),
  ('PC-0003', 'SG-GUL2PPTS', 8, 3.20, '2026-11-04', 'Kedai runcit Sejahtera', '2026-11-04T10:30:00Z'),
  ('PC-0004', 'SG-CWN2KRTS', 15, 4.50, '2026-11-04', '', '2026-11-04T10:30:00Z'),
  ('PC-0005', 'SG-SRP2PNDN', 12, 9.50, '2026-11-06', '', '2026-11-06T09:15:00Z'),
  ('PC-0006', 'SG-TSU2LPTS', 10, 2.10, '2026-11-07', '', '2026-11-07T14:00:00Z');

INSERT INTO usages (id, item_id, qty, unit_cost, date, method, note, created_at) VALUES
  ('US-0001', 'SG-ESPK2PQA', 1.8, 48.00, '2026-11-05', 'manual', '', '2026-11-05T20:00:00Z'),
  ('US-0002', 'SG-ESPK2PQA', 2.1, 48.00, '2026-11-09', 'manual', '', '2026-11-09T20:00:00Z'),
  ('US-0003', 'SG-ESPK2PQA', 1.6, 48.00, '2026-11-12', 'manual', '', '2026-11-12T20:00:00Z'),
  ('US-0004', 'SG-SUS2UHTK', 9, 6.80, '2026-11-10', 'scan', '', '2026-11-10T20:00:00Z'),
  ('US-0005', 'SG-GUL2PPTS', 3, 3.20, '2026-11-10', 'manual', '', '2026-11-10T20:00:00Z'),
  ('US-0006', 'SG-SRP2PNDN', 5, 9.50, '2026-11-11', 'scan', '', '2026-11-11T20:00:00Z'),
  ('US-0007', 'SG-CWN2KRTS', 6, 4.50, '2026-11-11', 'scan', '', '2026-11-11T20:00:00Z');

INSERT INTO adjustments (id, item_id, delta, date, reason, created_at) VALUES
  ('AD-0001', 'SG-TSU2LPTS', -1, '2026-11-10', 'Cawan rosak (kiraan fizikal)', '2026-11-10T18:00:00Z');
