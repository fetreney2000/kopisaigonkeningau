-- 0004_qr_code_enc.sql - Simpan kod QR log masuk dalam bentuk tersulit supaya admin
-- boleh melihat/mencetak semula kad sedia ada tanpa menukarnya.
-- Kunci penyulitan diterbitkan daripada PASSWORD_PEPPER, jadi salinan pangkalan data
-- sahaja tidak cukup untuk log masuk sebagai pengguna lain.
-- Nota: kod QR yang dicipta sebelum migrasi ini tidak dapat dipulihkan (hanya cincang
-- disimpan). Tukar kod sekali di menu Pengguna; kod baharu akan disimpan tersulit.
ALTER TABLE users ADD COLUMN qr_code_enc TEXT;
