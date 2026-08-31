# Catatan API PFI

Swagger: https://api-pfi.modoto.net/swagger/index.html (279 endpoint per 2026-08-27).

- **Login PWA agen** adalah `POST /api/mobile/auth/login` dengan body `{nip, password}`.
  Bukan `/api/Auth/login` — endpoint itu menuntut `{userId, password}` dan menolak
  kredensial agen dengan 401.
- **API tidak mengirim header CORS**; preflight `OPTIONS` dijawab 405. Semua panggilan
  harus lewat server Next (Server Action / Route Handler), tidak bisa fetch dari browser.
- **Envelope tidak konsisten**: `auth/login` memakai `{status: true, ...}`, sedangkan
  `MasterData/GetAll*` memakai `{success: true, ...}`. Parser harus menerima keduanya.
- **43 endpoint `/api/mobile/MasterData/GetAll*` sudah hidup** dan cocok jadi sumber
  dropdown offline: Branch, Product, Status, City, Province, District, SubDistrict,
  ActivityType, Agent, dll. Punya parameter `search` / `status`, tapi **tidak ada `since`**
  dan record-nya tidak membawa `updated_at` — jadi tidak mungkin sinkron inkremental.
- `GetAllStatus` mengembalikan `groupStatus: "LEAD"` berisi status lead resmi. Namanya
  **"In Progress"**, sedangkan desain Figma menulis "On Progress" — perlu dikonfirmasi.
- `GetAllCategory` adalah kategori **produk** (Term Life, Whole Life), bukan kategori lead
  (Referral / Natural Market). Belum ada master untuk kategori lead.
- `GET /api/mobile/MasterData/GetAllBankStaff` **mengembalikan HTTP 500** (bug server,
  per 2026-08-27). Modal Pilih Bank Staff belum bisa disambungkan sampai ini diperbaiki.
- **Tidak ada endpoint lead sama sekali** (CRUD maupun daftar), dan tidak ada endpoint
  sync/delta/changes.
- JWT berumur pendek (hitungan jam). `/api/mobile/auth/refresh` tersedia tapi belum dipakai
  di aplikasi.

Lihat juga [Offline-first & sinkronisasi](offline-first-sync.md).
