# Konvensi Database

Semua nama tabel dan nama kolom di database lokal PFI-EAPS harus **lowercase**, dan
spasi diganti **underscore** (`_`). Nama tabel juga harus **jamak**. Contoh: `leads`, `bank_staffs`, `branches`,
`sync_operations`. Nama kolom tetap tunggal: `nama_depan`, `tanggal_lahir`, `skor_akhir`.

**Why:** aturan ini diberikan user pada 2026-08-27 saat menyetujui rencana penyimpanan
lokal. Konsistensi penamaan penting karena data lokal nantinya dipetakan ke API dan
kemungkinan besar ke skema server, sehingga campur aduk casing akan menyulitkan
pemetaan dan debugging sinkronisasi.

**How to apply:** pakai lowercase snake_case untuk setiap `CREATE TABLE` dan kolom baru,
tanpa kecuali — termasuk kolom metadata sinkronisasi. Jangan ikut casing JSON dari API:
API .NET mengembalikan camelCase (`branchName`, `agentCode`), jadi harus ada satu lapisan
pemetaan camelCase → snake_case, dan lapisan itu disimpan di satu tempat saja supaya
tidak tersebar.

Lihat juga [Offline-first & sinkronisasi](offline-first-sync.md).

## Routing

Semua segmen URL memakai **bahasa Inggris**, bukan Indonesia.
Contoh: `/leads/create` — bukan `/leads/tambah`. Teks yang tampil di layar
tetap bahasa Indonesia; yang diinggriskan hanya URL-nya.
