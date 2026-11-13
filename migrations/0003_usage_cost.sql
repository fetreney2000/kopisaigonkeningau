-- 0003_usage_cost.sql - Rekod kos seunit pada setiap baris penggunaan (snapshot) supaya
-- laporan sejarah (Kos Penggunaan bulanan, Belanja vs Penggunaan) tidak berubah apabila
-- harga semasa item dikemas kini oleh pembelian baharu.
ALTER TABLE usages ADD COLUMN unit_cost REAL NOT NULL DEFAULT 0;

-- Isi kos untuk rekod sedia ada menggunakan harga item semasa (anggaran terbaik sekali sahaja)
UPDATE usages SET unit_cost = (SELECT i.unit_cost FROM items i WHERE i.id = usages.item_id);
