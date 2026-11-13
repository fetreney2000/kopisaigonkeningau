-- 0005_audit_users.sql - Jejak audit: siapa merekod stok masuk (pembelian) dan pelarasan.
-- Penggunaan (stok keluar) sudah menyimpan recorded_by sejak migrasi 0002.
-- Rekod lama kekal NULL kerana perekod asal tidak pernah disimpan.
ALTER TABLE purchases ADD COLUMN recorded_by TEXT;
ALTER TABLE adjustments ADD COLUMN recorded_by TEXT;
