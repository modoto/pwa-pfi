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

Per 2026-09-16 API mulai menyediakan bahan sinkronisasi (lihat [Catatan API](catatan-api.md)):

- `GET /api/mobile/SyncCheckSum/sync` memberi **checksum isi tiap tabel** di server (91 tabel,
  nama tabelnya sama dengan tabel lokal). Sudah dipakai penarikan master: tabel yang
  checksum-nya sama dengan tarikan terakhir dilewati (`master_syncs.checksum`).
- `POST /api/mobile/SyncCheckSum/sync/sqlite` ada tapi belum dicoba — perlu penjelasan tim
  backend sebelum dipanggil, karena POST ke endpoint sinkron bisa menulis di server.
- Endpoint lead sudah ada, tapi **hanya GET** (`GetAllLeads`, `GetAllLeadActivity`,
  `GetAllLeadEvents`, `GetAllLeadScore`). Artinya tarik-dari-server sudah mungkin, sedangkan
  kirim-perubahan dari perangkat belum.

Di halaman Profil ada dua tombol untuk data lead (`src/components/leads-maintenance.tsx`):

- **Tarik data lead dari API** — `GetAllLeads` + `GetAllLeadScore`, dicocokkan lewat
  `leads.server_id`. Lead yang `sync_status`-nya masih `pending` **tidak ditimpa** (perubahan
  lokal itu satu-satunya salinan selama endpoint tulis belum ada), dan lead lokal yang tidak
  ada di server dibiarkan. Skor dipakai baris dengan `sequence` terbesar per lead.
- **Hapus semua data lead** — mengosongkan `leads` beserta turunannya (`lead_assignments`,
  `lead_activities`, `lead_processes`, `lead_fna_priorities`, `lead_fna_answers`,
  `lead_illustration_fields`) dan antrean `sync_operations`. Perlu satu langkah konfirmasi
  karena tidak bisa dibatalkan. Sesudahnya data contoh **tidak** disemai ulang: penandanya
  disimpan di tabel `app_settings` (`leads_seeded`).

Pemetaan yang masih perlu dikonfirmasi saat menarik lead: `gender` 0/1 dianggap
Laki-Laki/Perempuan, `agentNip` dipakai sebagai "tenaga pemasar" dan `hdamNip` sebagai RSM
(API hanya mengirim NIP, bukan nama), serta Bank Staff belum terisi karena `GetAllLeads`
hanya membawa `bankStaffId`.

Yang masih harus diminta ke tim backend sebelum sinkron benar-benar bisa:
endpoint **tulis** lead (create/update/delete), endpoint delta (`?since=` + tombstone untuk record terhapus),
create yang idempoten (menerima `client_op_id`), dan versioning untuk optimistic concurrency.
Semua endpoint `GetAll*` yang ada sekarang tidak punya parameter `since`, jadi hanya bisa
full refresh. Per 2026-09-11 record-nya sudah membawa `updatedAt` / `lastUpdatedAt` /
`deletedAt`, jadi yang tersisa tinggal filter `since` di sisi backend.

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
- Master data sudah ditarik ke lokal (tombol di halaman Profil, lihat
  [Catatan API](catatan-api.md)). Layar membacanya dari tabel lokal lewat
  `listProducts` / `listFunds` di `src/lib/db/master-repo.ts` — **tidak pernah
  memanggil API langsung** (permintaan user 2026-09-11). Yang sudah memakai master:
  - FnA: Rekomendasi Produk + detailnya (`products`)
  - Sales Illustration langkah 1: Status Perkawinan, Pekerjaan, Tujuan Membeli Asuransi
    (`msfields` dengan `field_key` marital_status / job / purpose_of_insurance)
  - langkah 2: Nama Produk (`products`); Mata Uang, Cara Bayar, Masa Pembayaran, Masa
    Pertanggungan dan batas UP / usia masuk / top up berkala (`product_setups`); premi
    minimum per cara bayar (`ps_minimum_indicators`)
  - langkah 3: daftar rider (`ps_riders` + `riders`), batas UP dan masa per rider, pasangan
    rider terlarang (`disallowed_riders`)
  - langkah 5: modal Tambah Fund (`funds`)
  - Tambah/Edit Lead: Kategori dan Sumber (`msfields`, per channel agen — HDA memakai
    `lead_category_mobile_hda` + `lead_source_mobile`, Banca memakai
    `lead_category_mobile_banca` + `lead_source`)
  - modal Ubah Status Lead: pilihan status (`mobile_status_changes`, dari
    `GetDataStatusChangeMobile`); bila master belum ditarik dipakai daftar desain
  - Kuesioner Profil Risiko (FnA dan langkah Ilustrasi): pertanyaan, pilihan jawaban, dan
    bobot skornya dari `rpq_config_questions` + `rpq_config_answers`
  - Hasil Analisa Profil Risiko dan langkah Pilihan Investasi: skor dijumlahkan dari bobot
    jawaban, profilnya dipilih dari rentang di `mappings`, dan dana yang dianjurkan dari
    `fund_mapping_funds`

  Bila tabelnya belum ditarik, layar menampilkan ajakan ke halaman Profil atau
  mengunci dropdown dengan keterangan, bukan data statis. Belum tersambung: Hubungan dengan
  Pemegang Polis (tidak ada master-nya).

Jebakan yang sudah ditemukan dan diperbaiki: OPFS hanya mengizinkan satu pemegang
access handle per berkas. Worker halaman sebelumnya harus dihentikan saat `pagehide`,
dan pembukaan pool perlu retry — kalau tidak, pindah halaman kadang gagal dengan
`another open Access Handle`. Konsekuensi lain: **dua tab tidak bisa membuka database
bersamaan**; tab kedua akan menampilkan pesan agar menutup tab lain.

Paket `@sqlite.org/sqlite-wasm` tidak bisa di-bundle Turbopack (ada `new Worker` dengan
URL dinamis di dalamnya). Berkasnya disalin ke `public/sqlite/` oleh
`scripts/copy-sqlite.mjs` dan di-import worker saat runtime.
