# Offline-first & Sinkronisasi

Tujuan jangka panjang aplikasi PFI-EAPS (ditegaskan user 2026-08-27): PWA ini harus
bisa dipakai penuh **offline**, lalu **sinkron dua arah** dengan server lewat API.
User secara eksplisit meminta proses sinkronisasi dicatat sebagai perhatian utama —
bukan sekadar caching halaman.

Urutan kerja yang disepakati: **bangun CRUD ke penyimpanan lokal dulu**, sinkronisasi
menyusul ketika endpoint-nya tersedia. Saat ini API lead sama sekali belum ada
(279 endpoint di swagger, nol untuk lead).

Yang harus ada di tiap tabel lokal agar sinkron bisa jalan:
- id lokal (UUID buatan klien) + `server_id` yang diisi setelah sinkron
- `sync_status` (synced / pending / conflict), `updated_at`, `server_updated_at`
- `deleted_at` untuk soft delete — hapus permanen offline membuat server tidak pernah tahu
- tabel `sync_outbox`: antrean operasi (op, tabel, record_id, payload, client_op_id, attempts, last_error)
- `client_op_id` unik per operasi supaya replay setelah gagal separuh tidak menggandakan data

Yang masih harus diminta ke tim backend sebelum sinkron benar-benar bisa:
endpoint CRUD lead, endpoint delta (`?since=` + tombstone untuk record terhapus),
create yang idempoten (menerima `client_op_id`), dan versioning untuk optimistic concurrency.
Semua endpoint `GetAll*` yang ada sekarang tidak punya parameter `since` dan datanya
tidak membawa `updated_at`, jadi hanya bisa full refresh.

Catatan autentikasi offline: JWT dari `/api/mobile/auth/login` berumur pendek
(pernah kedaluwarsa di tengah sesi kerja). Offline token tidak bisa di-refresh.
Endpoint `/api/mobile/auth/pin` dan `/pin/update` kemungkinan besar memang disiapkan
untuk membuka aplikasi saat offline. Perlu keputusan: berapa lama aplikasi boleh
dipakai offline sebelum memaksa login ulang.

Lihat juga [Konvensi database](konvensi-database.md) dan [Catatan API](catatan-api.md).

## Status implementasi (2026-08-27)

Sudah ada:
- SQLite WASM di worker `src/lib/db/worker.ts`, VFS `opfs-sahpool` (tidak butuh COOP/COEP)
- Migrasi bernomor di `src/lib/db/schema.ts`, dicatat di tabel `schema_migrations`
- Tabel `leads` dan `sync_operations` (lihat konvensi penamaan)
- CRUD lengkap di `src/lib/db/leads-repo.ts`; setiap perubahan menulis baris data
  dan satu baris antrean dalam **satu transaksi**
- Hapus = soft delete (`deleted_at`), bukan hapus permanen
- Indikator "N perubahan menunggu sinkronisasi" di halaman Leads

Belum ada:
- Pengirim antrean (`sync_operations` hanya terisi, belum pernah dikirim) —
  menunggu endpoint lead di API
- Tarik perubahan dari server (butuh endpoint delta)
- Penyelesaian konflik
- Master data dari `/api/mobile/MasterData/GetAll*` belum disimpan lokal

Jebakan yang sudah ditemukan dan diperbaiki: OPFS hanya mengizinkan satu pemegang
access handle per berkas. Worker halaman sebelumnya harus dihentikan saat `pagehide`,
dan pembukaan pool perlu retry — kalau tidak, pindah halaman kadang gagal dengan
`another open Access Handle`. Konsekuensi lain: **dua tab tidak bisa membuka database
bersamaan**; tab kedua akan menampilkan pesan agar menutup tab lain.

Paket `@sqlite.org/sqlite-wasm` tidak bisa di-bundle Turbopack (ada `new Worker` dengan
URL dinamis di dalamnya). Berkasnya disalin ke `public/sqlite/` oleh
`scripts/copy-sqlite.mjs` dan di-import worker saat runtime.
