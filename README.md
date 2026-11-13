# Saigon Inventori ☕

Sistem inventori ringkas untuk kedai kopi — dibina khas untuk menjejak dua sumber stok:
**item francais** dan **item kedai tempatan**.

> A dead-simple inventory system for a coffee shop: track spend by source (franchisor vs local
> shops), monitor usage with QR-code check-out, and see cost/usage projections — on mobile and
> desktop.

## Ciri-ciri

| Ciri | Keterangan |
| --- | --- |
| **Akaun Pengguna** | 2 peranan: **admin** (akses penuh + urus pengguna) dan **staff** (imbas stok keluar + dashboard sendiri — **tiada maklumat kos/perbelanjaan dipaparkan**). Log masuk dengan kata laluan **atau** kod QR peribadi yang boleh dicetak. Sesi kekal 30 hari |
| **Papan Pemuka** | Nilai stok, belanja bulan ini (pecahan francais/tempatan), amaran stok, aktiviti terkini, unjuran 30 hari |
| **Inventori** | Senarai item dengan carian + tapis (Semua / Francais / Tempatan / Perlu Dipesan), status automatik: *Cukup / Hampir Rendah / Stok Rendah / Habis* |
| **Imbas (QR)** | Imbas kod QR item dengan kamera telefon → sahkan kuantiti → stok keluar/kemas direkod. Borang manual disediakan jika kamera tiada |
| **Kod QR** | Setiap item mendapat kod QR unik yang kekal sah; label boleh dicetak satu-satu atau **berpukal berGRID pada helaian A4** (4 preset sehingga 45 label/lembar, termasuk se padan Avery L4737 27/lembar), atau dimuat turun sebagai PNG |
| **Pembelian** | Rekod belian baru (kuantiti, kos seunit, tarikh, nota) — stok dan kos seunit item dikemas kini automatik; boleh batalkan rekod tersasar |
| **Laporan** | Belanja & kos penggunaan bulanan (carta), unjuran kos 30 hari akan datang, unjuran per item (purata harian, baki hari), penggunaan tertinggi, eksport CSV |
| **Pelarasan** | Betulkan beza kiraan fizikal (rosak, hilang, pembetulan) — diasingkan daripada pergerakan biasa supaya sejarah mudah diaudit |

## Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 (mudah alih dahulu — bar navigasi bawah di telefon, sidebar di desktop)
- **Backend**: Hono di atas Cloudflare Workers
- **Pangkalan data**: Cloudflare D1 (SQLite, percuma)
- **Imbasan QR**: [`qr-scanner`](https://github.com/nimiq/qr-scanner) (guna `BarcodeDetector` pelayar jika ada, ringan & tepat)
- **Penjanaan QR**: `qrcode`

## Cara Guna Harian

1. **Tambah item** (`Inventori` → ➕) — tetapkan sumber (Francais / Kedai Tempatan), kos seunit, dan *stok minimum* (paras amaran).
2. **Cetak label QR** — buka item → *Cetak Label* untuk satu label, atau `Inventori` → *Cetak Label* untuk **cetak pukal berGRID**
   (pilih item + bilangan salinan, preset saiz: Besar 8 / Biasa 15 / Avery L4737 27 / Kecil 45 label selembar A4 — jimat kertas).
   Kod QR mengandungi kod item (cth. `SG-K7X2QP4M`); nama item dicetak di bawah kod.
3. **Bila barang sampai** → `Pembelian` → rekod kuantiti + kos. Stok naik, belanja bulanan terkini.
4. **Bila barang digunakan** → imbas QR item dengan telefon → sahkan kuantiti → stok turun. Tiada kamera? Guna borang manual.
5. **Hujung minggu** → `Laporan` untuk unjuran kos dan belanja; item yang `Perlu Dipesan` ditandakan automatik.

> Unjuran dihitung daripada purata penggunaan 30 hari lalu × kos seunit. Semakin kerap anda
> merekod penggunaan, semakin tepat unjuran.

## Jalankan Di Komputer (dev)

```bash
npm install
npm run db:migrate:local      # buat jadual dalam D1 tempatan
npm run db:seed:local         # (pilihan) data contoh
npm run dev                   # buka http://localhost:5173
```

Untuk log masuk di dev, cipta fail `.dev.vars` (tidak disimpan dalam git) dengan *pepper*:

```
PASSWORD_PEPPER="nilai-pepper-anda"
```

> **Penting**: `.dev.vars` dibaca semasa pelayan dev dimulakan — jika anda mengubahnya,
> mulakan semula `npm run dev`.

Imbasan kamera berfungsi di `localhost` kerana dianggap konteks selamat.

## Log Masuk & Akaun Pengguna

1. **Persediaan pertama**: buka aplikasi — jika tiada akaun lagi, skrin *Persediaan Pertama*
   muncul untuk mencipta akaun **admin** pertama. Tiada kata laluan default.
2. **Peranan**:
   - **Admin** — akses penuh: inventori, pembelian, laporan, label, pengguna.
   - **Staff** — dashboard sendiri + imbas stok keluar sahaja. Kos, harga dan perbelanjaan
     **tidak dipaparkan langsung** kepada staff (disingkirkan di pelayan juga, bukan hanya disembunyikan).
3. **Kod QR log masuk**: setiap pengguna mendapat kod QR peribadi (`USR-XXXXXXXX`) yang boleh
   dicetak (`Pengguna` → *Kod QR* → *Cetak QR*). Kod ini **kunci log masuk kekal** — sesiapa yang
   memegangnya boleh log masuk sebagai pengguna tersebut, jadi simpan dengan selamat.
   Jika kad hilang: *Tukar Kod QR* menjana kod baharu — kod lama terus tidak sah.
4. **Admin boleh**: sunting nama pengguna/jawatan/peranan, tetapkan semula kata laluan
   (jana kata laluan sementara `Kopi-XXXXXX`, dipaparkan sekali sahaja), dan lumpuhkan akaun.
   Sistem sentiasa mengekalkan sekurang-kurangnya satu admin aktif.

## Keselamatan Kata Laluan

- Kata laluan disimpan sebagai **PBKDF2-HMAC-SHA256 (100,000 lelaran)** dengan salt rawak +
  *pepper* rahsia (ikut OWASP Password Storage Cheat Sheet) — pepper tidak pernah disimpan dalam D1.
- Sesi: kuki `HttpOnly; SameSite=Lax` 30 hari; D1 menyimpan **hash SHA-256 token sahaja**.
- Had kadar log masuk: 5 kegagalan → kunci 60 saat.
- Tukar kata laluan / lumpuhkan akaun melumpuhkan semua sesi pengguna tersebut.

### Tetapkan pepper pada produksi (wajib, sekali sahaja)

```bash
npx wrangler secret put PASSWORD_PEPPER
```

Jika pepper hilang, semua kata laluan mesti ditetapkan semula (kod QR log masuk tidak terjejas).

## Deploy ke Cloudflare (percuma)

1. **Cipta pangkalan data D1** dan salin `database_id` yang dipaparkan:
   ```bash
   npx wrangler d1 create saigon-inventory
   ```
2. **Kemas kini `wrangler.jsonc`** — gantikan `REPLACE_WITH_YOUR_DATABASE_ID` dengan ID tersebut.
3. **Buat jadual + (pilihan) data contoh** pada pangkalan data sebenar:
   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote       # pilihan — data contoh (seed/sample.sql)
   ```
4. **Deploy**:
   ```bash
   npm run deploy
   ```
   Aplikasi akan hidup di `https://saigon-inventory.<subdomain-anda>.workers.dev` — HTTPS automatik,
   jadi pengimbasan kamera berfungsi terus di telefon.

### Deploy automatik dari GitHub (pilihan)

Repositori ini disertakan `.github/workflows/deploy.yml` — setiap tekanan (push) ke `main`
akan membina dan deploy automatik ke Cloudflare. Setup sekali sahaja:

1. Dapatkan **Account ID** anda di Cloudflare Dashboard (halaman utama akaun, panel kanan).
2. Cipta **API Token**: Cloudflare Dashboard → My Profile → API Tokens → *Create Token* →
   gunakan templat **"Edit Cloudflare Workers"**, kemudian tambah kebenaran **D1 → Edit**
   (perlu untuk migrasi pangkalan data).
3. Dalam GitHub: **Settings → Secrets and variables → Actions → New repository secret**, tambah:
   - `CLOUDFLARE_API_TOKEN` — token dari langkah 2
   - `CLOUDFLARE_ACCOUNT_ID` — Account ID dari langkah 1
4. Selesai — setiap `git push` ke `main` akan deploy sendiri.

## Struktur Projek

```
src/
  server/index.ts     # API Hono di Workers (D1) — item, pembelian, penggunaan, pelarasan, ringkasan, laporan, pengguna
  server/auth.ts      # kriptografi kata laluan (PBKDF2 + pepper) & sesi kuki
  shared/types.ts     # jenis data dikongsi pelayan ↔ klien
  web/                # aplikasi React
    pages/            # Dashboard, StaffDashboard, Inventory, ScanPage, Purchases, Reports, Labels, Users, Login
  migrations/         # skema SQL D1 (berjejak — dijalankan oleh wrangler d1 migrations apply)
  seed/sample.sql     # data contoh (pilihan, jangan guna pada produksi)
wrangler.jsonc        # konfigurasi Workers + D1
```

## Nota Reka Bentuk (amalan terbaik industri)

- **Pergerakan disahkan** — pengimbasan tidak mengurangkan stok secara automatik; pengguna sahkan
  kuantiti dahulu (elak rekod hantu).
- **Sejarah penuh** — setiap pergerakan direkod dengan tarikh, kaedah (imbas/manual) dan nota;
  pembelian boleh dibatalkan untuk membetulkan kesilapan.
- **Pelarasan berasingan** — kiraan fizikal tidak dicampur dengan stok masuk/keluar.
- **Sasaran sentuh ≥ 44px**, angka tabular (`tabular-nums`), tiada anjakan susun atur — sesuai
  digunakan sambil berdiri di dapur.
- **Kod QR statik** — kandungan kod hanyalah kod item yang kekal, jadi label dicetak tidak perlu
  dicetak semula walaupun nama/harga item berubah.
