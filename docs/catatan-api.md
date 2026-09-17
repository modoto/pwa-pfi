# Catatan API PFI

Swagger: https://api-pfi.modoto.net/swagger/index.html (279 endpoint per 2026-08-27).

- **Login PWA agen** adalah `POST /api/mobile/auth/login` dengan body `{nip, password}`.
  Bukan `/api/Auth/login` — endpoint itu menuntut `{userId, password}` dan menolak
  kredensial agen dengan 401.
- **API tidak mengirim header CORS**; preflight `OPTIONS` dijawab 405. Semua panggilan
  harus lewat server Next (Server Action / Route Handler), tidak bisa fetch dari browser.
- **Envelope tidak konsisten dan bisa berubah**: `auth/login` dulu memakai
  `{status: true, ...}`; per 2026-09-11 (bersamaan dengan field baru `deviceNumber` di body
  login) berubah menjadi `{success: true, ...}`, sama seperti `MasterData/GetAll*`. Parser di
  `src/lib/api.ts` (`readEnvelope`) menerima keduanya — perubahan ini sempat membuat login
  yang sukses terbaca gagal dan menampilkan "Login berhasil" sebagai pesan error.
- **43 endpoint `/api/mobile/MasterData/GetAll*` sudah hidup** dan cocok jadi sumber
  dropdown offline: Branch, Product, Status, City, Province, District, SubDistrict,
  ActivityType, Agent, dll. Punya parameter `search` / `status`, tapi **tidak ada `since`**
  dan record-nya tidak membawa `updated_at` — jadi tidak mungkin sinkron inkremental.
- `GetAllStatus` mengembalikan `groupStatus: "LEAD"` berisi status lead resmi. Namanya
  **"In Progress"**, sedangkan desain Figma menulis "On Progress" — perlu dikonfirmasi.
- Modal Ubah Status Lead memakai dua pilihan dari desain: **"Contacted"** dan
  **"Drop Manual"**. "Drop Manual" belum dicek keberadaannya di `GetAllStatus`
  (`groupStatus: "LEAD"`) — perlu dikonfirmasi bersama soal "In Progress"/"On Progress".
- `GetAllCategory` adalah kategori **produk** (Term Life, Whole Life), bukan kategori lead
  (Referral / Natural Market). Belum ada master untuk kategori lead.
- `GET /api/mobile/MasterData/GetAllBankStaff` **mengembalikan HTTP 500** (bug server,
  per 2026-08-27). Modal Pilih Bank Staff belum bisa disambungkan sampai ini diperbaiki.
- **Tidak ada endpoint lead sama sekali** (CRUD maupun daftar), dan tidak ada endpoint
  sync/delta/changes.
- JWT berumur pendek (hitungan jam). `/api/mobile/auth/refresh` tersedia tapi belum dipakai
  di aplikasi.

Lihat juga [Offline-first & sinkronisasi](offline-first-sync.md).

## Pemeriksaan ulang MasterData (2026-09-16)

Diperiksa langsung dengan akun agen (415 path di swagger, 100 di `/api/mobile/`).

**Endpoint sinkronisasi akhirnya ada:**

- `GET /api/mobile/SyncCheckSum/sync` — checksum isi **91 tabel** di server
  (`{success, hasChanges, total, tables:[{moduleName, tableName, checksum, lastChecksum,
  needSync}]}`, tanpa `data`). Nama tabelnya sudah snake_case jamak, sama dengan tabel lokal
  kita. Sudah dipakai: penarikan master melewati tabel yang checksum-nya tidak berubah
  (`master_syncs.checksum`).
- `POST /api/mobile/SyncCheckSum/sync/sqlite` — **belum dicoba**; swagger tidak menjelaskan
  body maupun responsnya, dan POST ke endpoint sinkronisasi bisa mengubah data di server.
  Perlu ditanyakan ke tim backend: ini mengunggah SQLite dari perangkat, atau mengunduh?
- `GET /api/mobile/app-version?deviceType=` — versi aplikasi minimum (belum dipakai).

**Endpoint lead sudah ada** (sebelumnya nol): `GetAllLeads` (±100 kolom, termasuk data
SPAJ, e-sign, dan skor), `GetAllLeadActivity`, `GetAllLeadEvents`, `GetAllLeadScore`,
`GetDataLeadParent`, `GetDataLeadFilter`. **Semuanya hanya GET** — belum ada POST/PUT/DELETE
lead, jadi kirim-perubahan dari perangkat masih belum bisa. Tidak ikut ditarik sebagai master
karena ini data transaksional; lihat [Offline-first & sinkronisasi](offline-first-sync.md).

**Hilang (404), diganti `msfields`:** `GetCategoryHDA`, `GetCategoryBanca`,
`GetSourceByParentId`. Kategori dan sumber lead kini ada di `GetAllField`:
`lead_category_mobile_hda` (Referral, Natural Market), `lead_category_mobile_banca`
(Referral), `lead_source_mobile` dan `lead_source` — sumber menunjuk kategorinya lewat
`parentId`. Ada juga versi web (`lead_category_web_*`, `lead_source_web`) yang tidak dipakai
aplikasi mobile.

**Baru:** `GetAllAdditionalForm` (dokumen tambahan), `GetDataStatusChangeMobile` (dua status
yang boleh dipilih agen: **Contacted** dan **Drop Manual** — persis seperti desain), serta
varian tersaring `GetDataProduct`, `GetDataProductSetup`, `GetDataRider`, `GetDataDisallowed`,
`GetDataRiderPremiumRate`, `GetDataFundMappings`, `GetDataFieldByFieldKey`,
`GetDataStatusByGroupStatus`, `GetDataQuestionByCategoryName`, `GetDataRpqByRpqCode`.

**Sudah pulih:** `GetAllFormQuestion` dan `GetAllFormQuestionOption` (dulu HTTP 500).

**`ps_minimum_indicators` bisa berlaku umum**: baris untuk setup MAMS dan MSP memakai
`paymentMode` dan `premiumTerm` `null`, artinya premi minimumnya berlaku untuk semua cara
bayar dan masa. Pencarian aturan premi minimum di Rincian Produk mencoba dari yang paling
spesifik (cara bayar + masa) sampai yang paling umum (keduanya null).

**Kuesioner Profil Risiko (RPQ) akhirnya lengkap.** Pertanyaannya tidak punya endpoint
`GetAll*` sendiri; yang memuatnya adalah `GetDataRpqByRpqCode?rpqCode=RPQ-001`, yang
membalas satu konfigurasi berisi `questions` beserta `answers` dan `weightOfValue`.
Penarikan master meratakannya ke tabel `rpq_config_questions` (lihat
`src/app/actions/master-data.ts`). Sepuluh pertanyaan dengan bobot 10–50; **skor maksimal
445**, sedangkan rentang "Aggresive" di `GetAllMapping` mulai dari **450** — jadi profil
Aggresive tidak pernah tercapai. Perlu dikonfirmasi ke tim bisnis: bobotnya yang kurang,
atau rentangnya yang perlu digeser.

Profil investasi diambil dari `GetAllMapping` (Conservative 0–250, Moderate 250–350, Growth
350–450, Aggresive 450–550, semuanya `productId` 31) dan daftar dananya dari
`GetAllFundMappingFund` → `GetAllFund` (sama isinya dengan `GetDataFundMappings`).

**Perubahan data yang berdampak ke layar:**

- **Produk jadi 7** (dulu 3): tambahan MAML VIP (221), MAML VVIP (222), MAMS (153), dan
  MSP "Mega Saving Protection" (152) — jadi `MSP.xlsm` di `src/calculators/` adalah produk ini.
  Setup MAMS (id 6) dan MSP (id 7) sempat kosong; **per 2026-09-17 sudah diisi** user lewat
  backoffice: masa asuransi 15–20 tahun, cara bayar Tahunan/Bulanan, masa bayar premi 7–10
  tahun, mata uang IDR, usia masuk 18–55, premi minimum Rp3.000.000. MSP `isTwoWayCalculation`
  dan `isSumAssuredEditable` keduanya true; MAMS keduanya false.
- **`GetAllIllustrationTemplate` jadi 7**, termasuk "MAML VIP Riplay" dan "MAML VVIP Riplay".
  Berkas templatenya belum ada di `public/riplay`; ketiga varian MAML sementara memakai
  `replay_personal_maml.docx` karena `description` produknya sama.
- **`GetAllFund` menambah `investAssumptionsN/Z/P`** (-1 / 0 / 4-8 persen) — sama dengan asumsi
  di workbook MSL/MAML.
- `GetAllStatus` memakai `groupStatus: "lead_status"` (dulu "LEAD") dan memuat 16 status lead,
  termasuk **"In Progress"** (desain menulis "On Progress") dan "Drop Manual".
- **Login mengembalikan `channel` dan `channelId`** (agen uji: HDA / 6). Dipakai memilih
  kategori dan sumber lead per channel.
- `GetAllPasswordResetOtp` masih ada dan masih **tidak ditarik** ke perangkat.

## Pemeriksaan ulang MasterData (2026-09-11)

Diperiksa langsung dengan akun agen, bukan hanya dari swagger:

- Swagger kini memuat **71 endpoint** di `/api/mobile/MasterData/` (sebelumnya 44).
- **Hilang**: `GetAllAuditTrail`, `GetAllRole`, `GetAllRolePosition`, dan `GetAllAgent` /
  `GetAllUser` (diganti `GetAgentById/{id}` / `GetUserById/{id}`). Typo
  `GetAllIIllustrationTemplate` diperbaiki menjadi `GetAllIllustrationTemplate`.
- **Rusak**: `GetAllFormQuestion` dan `GetAllFormQuestionOption` membalas **HTTP 500**.
  `GetAllBankStaff` yang dulu 500 kini **sudah pulih**.
- `GetAllActivityType` mengembalikan data yang **sama persis** dengan `GetAllActivityNote`
  (`activityTypeId`, `note`: "Visit 1", …) — tampaknya bug server.
- **Kategori & sumber lead kini ada**: `GetCategoryHDA` (Referral, Natural Market) dan
  `GetCategoryBanca` (Referral). `GetSourceByParentId` kosong tanpa parameter; dengan
  `?parentId=<id kategori>` mengembalikan sumbernya, mis. Banca → Referral →
  "MCMS - Mega First", "MCMS - Non Mega First", dst. Ini sama dengan teks di desain.
- Hampir semua record sekarang membawa **`updatedAt`, `lastUpdatedAt`, `deletedAt`**.
  Parameter `since` tetap belum ada, jadi masih muat ulang penuh — tapi penanda waktunya
  sudah cukup untuk sinkron inkremental begitu backend menambahkan filternya.
- `GetAllPasswordResetOtp` berisi email pengguna, hash OTP, dan hash token reset
  password. **Tidak ditarik ke perangkat** — perlu ditanyakan ke backend kenapa endpoint
  ini bisa dibaca akun agen.
- Ukuran terbesar: `GetAllSubDistrict` ±84 ribu baris, `GetAllDistrict` ±7 ribu,
  `GetAllPsValue` ±1 ribu baris × 116 kolom.
- **Login mengikat akun ke perangkat**: body login kini punya `deviceNumber`, dan login
  dengan nilai berbeda dari login pertama ditolak "Device tidak sesuai".

  Sejak 2026-09-17 aplikasi mengirim **UUID** di situ, bukan lagi teks tetap `"string"`
  (`src/lib/device-number.ts`). UUID-nya dibuat sekali lalu disimpan di perangkat —
  `localStorage` **dan** cookie berumur 10 tahun, karena keduanya bisa terhapus
  sendiri-sendiri — sehingga login berikutnya memakai nomor yang sama. Konsekuensinya:
  akun yang tadinya terikat ke `"string"` perlu **direset ikatan perangkatnya** di
  backoffice sekali, dan agen yang membersihkan data situs **serta** cookie akan minta
  reset lagi. Kalau nomornya tidak terbaca (penyimpanan diblokir peramban), login ditolak
  di sisi aplikasi dengan pesan agar halaman dimuat ulang — bukan dikirim ke API dengan
  nomor acak, yang justru akan mengikat ulang perangkat.

## Penarikan master data ke lokal (2026-09-02)

42 dari 44 endpoint `MasterData/GetAll*` ditarik ke database lokal lewat tombol di
halaman Profil. `GetAllAgent` dan `GetAllUser` sengaja dilewati atas permintaan user —
isinya data pegawai, bukan master untuk dropdown.

Swagger **tidak mendeskripsikan bentuk respons** endpoint-endpoint ini (semuanya hanya
"200 OK"), jadi kolom tabel lokalnya dibuat dari data yang benar-benar datang: nama field
camelCase diubah ke snake_case, kolom baru yang muncul belakangan ditambahkan dengan
`alter table`. Nilai non-primitif (objek/array bersarang) disimpan sebagai JSON.

Tiap tarikan adalah **muat ulang penuh** — tabel dikosongkan lalu diisi ulang dalam satu
transaksi — karena tidak ada parameter `since` maupun penanda `updated_at` di API. Master
data tidak masuk `sync_operations`: arahnya satu jalur, server → lokal.

Riwayat penarikan (jumlah baris, waktu, pesan error) ada di tabel `master_syncs`.
