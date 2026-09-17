# Kalkulator Ilustrasi

## Kalkulator per produk (2026-09-11)

User menaruh satu workbook per produk di `src/calculators/`. Status port-nya:

| Workbook | Produk | Status | Kode |
|---|---|---|---|
| `MAML.xlsm` | Mega Asuransi Maksima Link | **di-port, cocok 100%** — 99 tahun × 17 kolom (1.683 sel) | `maml-engine.ts`, `maml-tables.ts` (`npm run maml:tables`) |
| `MAME.xlsx` | Mega Asuransi Maksima Edukasi | **di-port** — premi/akumulasi/meninggal cocok (40 sel); nilai tunai & beasiswa tidak bisa dibandingkan karena workbook-nya `#N/A` | `mame-engine.ts`, `mame-tables.ts` (`npm run mame:tables`) |
| `MSL.xlsm` | Mega Signature Link | di-port, **cocok 100%** — 58 tahun (986 sel) | `msl-engine.ts`, `msl-tables.ts` |
| `MPOL.xlsm` | Mega (Proteksi) Optima Link | belum | struktur mirip MSL/MAML, bayar sekaligus |
| `MAMS.xlsm` | Mega Asuransi Maksima Solusi (produk 153) | **di-port** — 134 dari 140 sel contoh cocok; 6 sisanya nol di workbook karena sel persentasenya `#N/A` | `rop-engine.ts`, `rop-tables.ts` (`npm run rop:tables`) |
| `MSP.xlsm` | Mega Saving Protection (produk 152) | **di-port** — cocok 100% dengan contoh workbook (105 sel) | `rop-engine.ts`, `rop-tables.ts` (`npm run rop:tables`) |
| `MAPAN.xlsx` | Mega Proteksi Masa Depan | belum | ±400 ribu rumus harian |
| `AMW.xlsx` | Asuransi Mega Warisan (?) | tidak bisa di-port otomatis | tabel premi berupa **gambar** PNG, bukan sel |

Produk di master per 2026-09-11 hanya MAML dan MAME, jadi dua itu yang dikerjakan dulu.
`src/lib/calc/unit-link.ts` memilih mesin unit link menurut nama produk; MAME dipakai
langkah Kutipan (`mame-projection.tsx`) dan RIPLAY.

Temuan saat port:

- **MAMS memakai mesin yang sama dengan MSP** (`rop-engine.ts`): rumus `Illustration` dan
  `ROP_Rates` di kedua workbook sama persis, dan tabel tarifnya identik — ekstraktor
  (`npm run rop:tables`) menyimpan keduanya terpisah dan mencetak "identik"/"BERBEDA" tiap
  dijalankan supaya perbedaan di kemudian hari langsung terlihat. Tarif MSP.xlsm disimpan
  dengan derau floating point (1,1500000000000001), jadi dibulatkan saat ekstraksi.
- **Sel persentasenya `#N/A` di MAMS.xlsm** (INDIRECT ke tabel bernama, sama seperti
  MAME.xlsx), jadi tiga baris manfaat tahapan terakhir tampil nol di workbook. Aplikasi
  memakai tarif dari tabel sehingga nilainya terisi — itu sebabnya 6 dari 140 sel berbeda.
- **Template MAMS masih membawa contoh 15 tahun**: label tahun di tabel skenario pertama
  ditulis tetap (11–15) dan di tabel skenario lain angkanya menempel di sel penanda
  (`<Policy year> 11`). Angka yang menempel dibersihkan otomatis (`literalsBefore` di
  riplay-fill.ts); label tetap di tabel pertama **perlu diganti penanda** oleh tim bisnis
  agar benar untuk masa asuransi selain 15 tahun.
- Yang belum terisi di template MAMS: kolom Nilai Tunai (butuh faktor CV dari sheet
  `CV_table` yang juga `#N/A`) dan tabel tarif brosur di bagian belakang (`percentage of
  living benefit` ×342) yang memuat kolom masa bayar 5 dan 6 — tidak ada di workbook.

- **MSP (Mega Saving Protection)**: premi tahunan = UP / masa pembayaran (`Illustration!C11`) —
  "uang pertanggungan" di produk ini sebenarnya total premi yang direncanakan, jadi Rincian
  Produk menghitungnya dua arah. Manfaat meninggal 200% akumulasi premi, kecelakaan 400%.
  Manfaat tahapan dibayar lima kali: 50% + 50% pada tahun ke-(masa − 4) dan ke-(masa − 3),
  lalu tiga kali `ROUNDDOWN((persentase − 100%) / 3)` pada tiga tahun terakhir, tiap
  pembayaran dibulatkan ke atas ke ribuan terdekat. Persentasenya dari `ROP_Rates` menurut
  cara bayar, usia masuk, masa asuransi (15–20), dan masa pembayaran (7–10). Pilihan masa dan
  cara bayar di formulir tetap dari master (setup MSP sudah diisi 2026-09-17), tapi master
  membolehkan masa bayar 7–10 untuk **semua** masa asuransi sedangkan tabel tarif hanya punya
  sebagian kombinasi (masa 15 → hanya 7 tahun; 16 → 7–8; 17 → 7–9). Kombinasi yang tidak ada
  ditolak saat menekan "Selanjutnya", dengan menyebut masa bayar yang tersedia.

- **Hitung dua arah UP ↔ Premi Dasar** (`src/lib/calc/two-way.ts`): di langkah Rincian Produk
  agen memilih salah satu lewat radio, satunya dikunci dan diisi otomatis. MAME memakai rumus
  pastinya (UP = 150% × premi tahunan × masa pembayaran). Unit link **tidak punya rumus
  tunggal** — MAML.xlsm hanya menetapkan rentang: batas bawah `MAX(5 × premi tahunan; minimum
  produk)` (`input!E36`) dan batas atas `pengali usia × premi tahunan` (`input!E37`, tabel
  `Assumption!H5:J17`: usia 1–15 → 125× sampai usia 63–65 → 8×). Aplikasi mengisi **batas
  bawahnya** dan menyebutkan batas atas di keterangan. **Perlu dikonfirmasi tim bisnis**:
  apakah UP otomatis untuk unit link memang harus batas bawah, atau ada pengali baku lain.
  Mode bawaannya mengikuti `isSumAssuredEditable` di master (MAML false → agen mengisi premi).

- **Usia memakai ulang tahun terdekat** (nearest birthday), bukan ulang tahun terakhir:
  `DATEDIF(DoB; Tanggal; "Y") + IF(DATEDIF(DoB; Tanggal; "yd") > 365/2; 1)` — persis seperti
  `input!E16` di MSL.xlsm dan MAML.xlsm. Lahir 2 Oktober 1990 dihitung pada 16 September 2026
  menjadi **36 tahun**, bukan 35. `hitungUsia` di `src/lib/lead-form-data.ts` memakai rumus ini
  untuk seluruh aplikasi (tampilan usia, masukan mesin proyeksi, batas usia produk), dan sudah
  dicocokkan dengan rumus Excel pada 20 ribu kombinasi tanggal. Dua catatan: aplikasi memakai
  **tanggal hari ini** sebagai acuan sedangkan workbook memakai tanggal terbit polis
  (`input!E9`), dan field `age` yang dikirim API lead memakai ulang tahun terakhir sehingga
  bisa berbeda satu tahun.

- **Proyeksi MAML sebelumnya salah**: memakai MSL.xlsm, padahal asumsi MAML berbeda
  (biaya admin Rp35.000 vs Rp20.000; biaya penebusan 85/65/45/30/20/0%; biaya akuisisi
  40/20/10/0%; COI per 1000 UP dibedakan pria/wanita; bonus loyalitas lain). Sekarang
  MAML memakai mesinnya sendiri.
- MAML: masa asuransi bukan isian — selalu sampai usia 100 (`Coverage = 100 − usia`).
  Pilihan masa pertanggungan dari master (`policy_term` 1–10) diabaikan untuk proyeksi.
- MSL dan MAML: porsi penarikan dari dana top up memakai saldo top up skenario
  **negatif** untuk ketiga skenario (rumus `DO`), dan nilai dana dibulatkan per dana
  sebelum dijumlah. Port MSL lama belum begitu; sudah diperbaiki (selisihnya < Rp1, atau
  lebih bila ada penarikan).
- MAME: premi dihitung dari UP — `ROUND(UP / (150% × masa bayar))`. Langkah Rincian
  Produk menghitung dua arah (UP ↔ premi). Semua tarif dicari menurut **usia pemegang
  polis**. Tarif beasiswa di workbook sama dengan master `ps_maturities`.
- MAME.xlsx adalah ekspor Google Sheets: rumusnya memanggil tabel bernama
  `MaturityRate_Yearly` / `CVRate_Monthly` yang di berkasnya bernama `Table_5` dst., jadi
  Excel menampilkan `#N/A`. Ekstraktor membaca rentang selnya langsung.
- MAME: sel beasiswa baris tahun ke-6 merujuk tahun ke-7 (`E12`) — untuk masa 7 tahun
  beasiswanya tampil setahun lebih awal di workbook. Tidak ditiru.

## Catatan awal MSL.xlsm (2026-09-01)

Workbook ini sebelumnya dipakai untuk MAML. Namanya di dalam workbook "Mega Signature
Link" (`input!E5`) / "Mega Investa Link" (`Assumption!E4`) — dan memang produk lain;
MAML sekarang punya MAML.xlsm sendiri.

## Isi workbook

| Sheet | Isi |
| --- | --- |
| `input` | Semua masukan ilustrasi (lihat di bawah) |
| `Assumption` | Parameter produk: biaya, tabel bonus, asumsi imbal hasil |
| `Calc_Annual` | Proyeksi tahunan ~118 kolom: Basic Fund, Top Up Fund, Total Fund; 3 skenario × 4 dana |
| `COI_COR_Table` | Tarif COI dan rider per usia (±100 baris); named range `PAA_Tab`, `PAAB_Tab`, dll |
| `output` | Lembar tampilan hasil |
| `Majesco`, `Simulation`, `Check_POS` | Tersembunyi |

### `input`

Cocok dengan langkah "Rincian PP dan CT" serta "Rincian Produk" yang sudah dibangun:
mata uang, cara bayar, masa pembayaran, tanggal terbit, data tertanggung dan pemegang
polis (tanggal lahir, usia, jenis kelamin), Premi Dasar + Top Up, Uang Pertanggungan,
alokasi empat dana investasi (wajib total 100%), serta jadwal Top Up Tunggal dan
Penarikan yang diisi **per usia tertanggung** — bukan per tahun polis; tahun polis
dihitung `usia - Insured_Age + 1`.

Delapan rider dengan kolom Y/N, SA, OC, dan % extra mortalita:
Mega PA A, Mega PA AB, Mega HCP, Mega HCP Plus, Mega CI PLUS, Mega WP,
Mega Spouse Payor, Mega Parent Payor.

Batas Uang Pertanggungan: minimum `MAX(5 × premi dasar, Rp 100 juta)`;
maksimum `SA multiplier × premi dasar`, multiplier dari tabel rentang usia
(`Assumption!H5:J16`, mis. usia 0–15 → 125×, 66–70 → 6×).

### `Assumption` (parameter utama)

- Masa pertanggungan sampai usia **100**; usia masuk tertanggung 1–70, pemegang polis 18–85
- Premium loading: tahun polis 1 = **35%**, tahun 2+ = 0
- Alokasi Top Up: **3%**
- Admin fee: **Rp 20.000/bulan**
- Maintenance fee: **0,417%/bulan (5,004%/tahun)** tahun 1–7, lalu 0
- Biaya surrender/penarikan per tahun polis: 80%, 60%, 40%, 30%, 20%, 10%, 5%, 0%, 0%…
- Loyalty bonus: 0 sampai tahun 5, lalu 3%, 4%, 5%, 6%, 7%, 8% (tahun 12+ tetap 8%)
- Santunan meninggal (% UP) per tahun: 20%, 40%, 60%, 80%, 100%, seterusnya 100%
- Asumsi imbal hasil bersih tiga skenario (negatif / nol / positif):
  Liquid −1/0/4%, Balanced −1/0/7%, Equity −1/0/8%, Fixed Income −1/0/5%

Lihat juga [Catatan API](catatan-api.md) — endpoint ilustrasi belum ada sama sekali,
jadi perhitungan ini harus jalan di klien agar tetap bisa dipakai offline.

## Yang masih perlu dikonfirmasi pada hasil port

- **Padanan rider** (2026-09-11): daftar rider kini dari master lokal (`ps_riders` +
  `riders`), dipetakan ke komponen tarif workbook lewat singkatan di kolom `description`
  — `RIDER_CODE_TO_ENGINE` di `src/lib/rider-data.ts`: CIP → CI Plus, HCP/"Mega HCP" → HCP,
  HCPP → HCP Plus, PAA → PA A, PAB → PA AB, WP → WP, PP → Parent Payor, SP → Spouse Payor.
  **Mega 45 CI (C145) dan Mega CIWP belum punya tarif** di workbook. Kolom Premi di langkah
  Rider = biaya rider tahun pertama / 12 dari `firstYearRiderCosts`. Tarif dari master
  `rider_premium_rates` belum dipakai — isinya baru beberapa baris contoh.
- **Occupational class** PA A / PA AB belum ditanyakan di formulir; sementara dipakai
  kelas 1.
- **Top Up Berkala**: formulir mencatatnya per tahun polis (tahun + jumlah), sedangkan
  workbook memodelkan top up berkala sebagai jumlah tetap tiap tahun selama masa bayar
  (`input!E30`) — perlu dikonfirmasi mana yang dimaksud. Di mesin, isian berkala masuk
  sebagai `regularTopUps` (per tahun polis) dan Top Up Tunggal sebagai `singleTopUps`,
  jadi kolom "Top Up Berkala" dan "Top Up Sekaligus" di Kutipan Ilustrasi terpisah.
  Perhitungannya sama: keduanya masuk dana top up dan sama-sama kena alokasi top up 3%.
- **Santunan meninggal**: workbook mengalikan faktor tabel dua kali
  (`output!K` sudah memuat faktor, lalu dikalikan lagi di `output!X`). Di kode dipakai
  sekali; hasilnya sama untuk tertanggung usia 5 tahun ke atas, berbeda untuk usia 1–4.
- **Masa Pertanggungan / Pembayaran**: pilihan kini dari `product_setups.policy_term` dan
  `premium_term` (ditampilkan "N Tahun"). Untuk MAML isinya 1–10 tahun dan 1–3 tahun —
  terasa pendek untuk unit link yang di workbook berjalan sampai usia 100; perlu
  dikonfirmasi apakah data master-nya memang begitu. Parser di `msl-input.ts` tetap
  menerima bentuk "Sampai Usia 65 Tahun" maupun "20 Tahun".

## Penyaluran hasil hitung ke RIPLAY Personal

Sejak 2026-09-11 tiap produk punya template sendiri di `public/riplay/` (dikirim user).
Template dipilih lewat nama lengkap produk — kolom `description` di master `products`,
sama dengan isian "Nama Produk" di dokumennya — lihat `src/lib/riplay-templates.ts`.
Master `illustration_templates` hanya menyimpan nama template, bukan berkasnya.

| Template | Produk | Sumber angka |
|---|---|---|
| `replay_personal_maml.docx` | Mega Asuransi Maksima Link | proyeksi MSL.xlsm — **terisi penuh** |
| `replay_personal_mame_fuw.docx` / `_sio.docx` | Mega Asuransi Maksima Edukasi | rumus di template + `ps_maturities` — **terisi penuh** |
| `replay_personal_mega_warisan.docx` | Mega Warisan | rumus yang ditulis di penandanya |
| `replay_personal_makna.docx`, `_mams`, `_mapan`, `_mpol` | MAKNA, Maksima Solusi, Proteksi Masa Depan, Proteksi Optima Link | hanya data nasabah/premi/UP; tabel aktuaria belum ada kalkulatornya |
| `riplay_personal_msl.docx` | Mega Signature Link | proyeksi MSL.xlsm |

Hanya MAML dan MAME yang ada di master produk per 2026-09-11; template lain sudah
terdaftar supaya langsung terpakai begitu produknya muncul di master.

Pengisian (`src/lib/riplay-values.ts`):

- Nilai umum (nama, tanggal lahir, usia, jenis kelamin, premi, UP, masa, cara bayar,
  rider, dana, agen, tanggal cetak) dipakai semua template. Penanda dicocokkan tanpa
  memedulikan huruf besar/kecil dan tanda baca, karena tiap template mengeja penanda yang
  sama berbeda-beda (`<Insured age>`, `<age of insured>`, `<Age of Insured>`).
- Penanda berulang diisi mengikuti urutan kemunculan (`src/lib/riplay-fill.ts`), sehingga
  pratinjau dan berkas `.docx` yang diunduh selalu sama isinya.
- Penanda petunjuk penyusun template ("This row showed only rider is chosen", "Only showed
  if CI taken", …) dihapus otomatis (`isInstruction`).
- Penanda yang terpecah antar-run Word digabung saat template dimuat di browser
  (`src/lib/riplay-template.ts`), jadi template baru cukup ditaruh di `public/riplay/`.
- Template Mega Warisan memakai kurung siku `[...]`; keduanya didukung.

MAML (dari kalkulator MSL.xlsm):

- 318 `<Refer to actuarial calc>` = 3 asumsi tingkat hasil investasi dana terpilih
  (negatif/nol/positif) + tabel proyeksi 60 tahun × 5 kolom (penarikan, bonus loyalitas,
  nilai polis tiga skenario; **jutaan rupiah**) + tabel penebusan tahun 1–5 × 3 skenario
  (rupiah penuh).
- Simulasi memakai skenario **positif** sesuai teks template: nilai polis tahun ke-10,
  penarikan tahun ke-4 (nilai − 30%), penebusan tahun ke-5 (nilai − 20%).
- `<age of insured>` (usia masuk) dan `<age of Insured>` (usia di tahun ke-10 pada
  simulasi meninggal) sengaja dibedakan menurut ejaannya.

MAME (FUW / SIO — sama isinya, beda metode seleksi risiko; agen memilih di langkah
RIPLAY karena master tidak menyimpannya):

- Manfaat meninggal = 150% akumulasi premi yang disetahunkan; kecelakaan = 200% dari itu
  (rumus dari teks template). Tabel 10 tahun; tahun di luar masa asuransi diisi "-".
- Beasiswa = `rate_value`% × total premi, `rate_value` dari `ps_maturities` menurut cara
  bayar, usia masuk, masa asuransi, dan masa pembayaran. **Asumsi**: `rate_value` adalah
  persen dari total premi — perlu dikonfirmasi.
- Kolom Nilai Tunai tetap teks "Please refer to the cash value table from actuary";
  tabelnya tidak ada di master.

Catatan:

- Template MAPAN dan Mega Warisan masih menyimpan **revisi Word yang belum di-accept**
  (tracked changes). Teks yang dihapus tidak tampil dan tidak diisi, tapi berkas unduhan
  ikut membawa revisi itu — sebaiknya template-nya di-accept dulu oleh tim bisnis.
- Template MAML baris dana dan rider berisi teks contoh tetap ("PFI Mega Life Fixed Income
  Fund", "100%", "Mega HCP"); bila dana/rider yang dipilih lain, teks contoh itu tetap
  tampil di samping nilai yang diisi.
- Kalimat "dengan asumsi tingkat investasi moderat" di template MSL memakai skenario **Nol**.

## Tampilan RIPLAY: PDF hasil LibreOffice

Sejak 2026-09-17 langkah RIPLAY menampilkan **PDF**, bukan lagi pratinjau HTML.
Alasannya tata letak: `docx-preview` menggambar ulang dokumen dengan CSS sehingga hasilnya
hanya mendekati Word, sedangkan yang dibaca nasabah harus sama dengan berkas `.docx` yang
diunduh agen. LibreOffice memakai mesin tata letak yang sama dengan mesin cetaknya, jadi
PDF-nya sepadan dengan dokumen aslinya.

Alurnya:

1. Dokumen **diisi di perangkat** (`src/lib/riplay-docx.ts` — jalur yang sama dengan
   unduhan `.docx`, supaya keduanya tidak mungkin berbeda isinya).
2. `.docx` terisi dikirim ke `POST /api/riplay/pdf` (butuh sesi), dikonversi
   `soffice --headless --convert-to pdf` (`src/lib/docx-to-pdf.ts`), PDF-nya dibalas.
3. PDF disimpan di **OPFS** di direktori `riplay-pdf/` dengan nama
   `<leadId>__<templateId>__<sidik jari>.pdf` (`src/lib/riplay-pdf.ts`). Sidik jarinya
   SHA-256 isi `.docx`, jadi begitu ada angka ilustrasi yang berubah, dokumennya berubah
   dan PDF lama otomatis tidak terpakai; versi lama milik lead + template yang sama dihapus.
4. Kunjungan berikutnya membaca dari simpanan — termasuk saat agen **offline**.

Bila konversinya tidak bisa dijalankan (offline dan belum pernah dibuat, server tidak
terjangkau, atau LibreOffice belum terpasang), layar kembali ke pratinjau HTML dengan
keterangan, dan tombol "Download PDF" kembali memakai dialog cetak peramban. Tombol
"Download Dokumen" (`.docx`) tidak terpengaruh.

Catatan pemasangan:

- Server produksi (Ubuntu): `apt install libreoffice-writer` sudah cukup — tidak perlu
  LibreOffice lengkap. Prosesnya berjalan sebagai proses anak Node, jadi `next start`
  harus punya izin mengeksekusi binernya dan menulis di direktori sementara.
- Laptop pengembang (Windows): `winget install TheDocumentFoundation.LibreOffice`.
- Lokasi binernya dicari otomatis (lokasi bawaan tiap OS, lalu PATH); kalau dipasang di
  tempat lain, setel `LIBREOFFICE_PATH` (lihat `.env.example`).
- Tiap konversi memakai **profil LibreOffice sendiri** di direktori sementara
  (`-env:UserInstallation`). Tanpa itu permintaan kedua yang datang bersamaan ditolak
  karena profil bawaannya sudah dikunci proses pertama.
- `GET /api/riplay/pdf` membalas `{tersedia: boolean}` — dipakai untuk memeriksa
  pemasangan di server tanpa harus mengirim dokumen.
- Waktu konversi (diukur di laptop pengembang, LibreOffice 26.8): `riplay_personal_msl.docx`
  18 halaman ±4 detik, `replay_personal_mams.docx` 33 halaman ±33 detik. Template MAMS
  memang berat (brosur penuh tabel dan gambar); karena hasilnya disimpan di perangkat,
  tunggu selama itu hanya terjadi saat angka ilustrasinya berubah.

## Tanda tangan di dokumen RIPLAY

Tanda tangan dari langkah terakhir ilustrasi (kanvas, disimpan sebagai PNG data URL di
`lead_illustration_fields`: `pp_tanda_tangan` dan `tp_tanda_tangan`) disisipkan ke dokumen
sebagai **gambar sungguhan** oleh `src/lib/riplay-signature.ts`. Karena penyisipannya
dilakukan pada berkas .docx sebelum dipakai, hasilnya ikut ke tiga-tiganya sekaligus:
pratinjau, PDF, dan berkas yang diunduh.

Templatenya tidak punya penanda untuk tanda tangan, jadi tempatnya dicari:

- Blok tanda tangan selalu di bagian akhir dokumen (dibatasi 20% paragraf terakhir), berisi
  label ("Tenaga Pemasar yang Menjelaskan", "Calon Pemegang Polis"), ruang kosong, lalu nama.
- Yang dipakai sebagai jangkar adalah **paragraf nama** (`<Name of Agent>`, `<AgentName>`,
  `<Name of Policy Holder>`, `<PolicyHolderName>`); gambar ditaruh di sel kosong **satu baris
  di atasnya pada kolom yang sama**.
- Blok itu berupa tabel dengan banyak kolom sempit, jadi pencarian harus mengikuti struktur
  tabelnya. Paragraf kosong yang tepat mendahului nama dalam urutan dokumen biasanya ada di
  sel lain selebar setengah sentimeter — gambar yang ditaruh di situ meleset dari kotaknya.
- Template Mega Warisan tidak memuat penanda nama sama sekali, jadi jangkarnya labelnya dan
  gambar ditaruh di sel kosong di bawahnya.
- Paragraf pemuat gambar diratakan tengah dan indentasinya dibuang; ukuran gambar dibatasi
  1,4 cm tinggi dan 4 cm lebar dengan rasio asli dijaga.

Diuji ke sepuluh template: semuanya menerima dua tanda tangan, dan jumlah halaman PDF tidak
berubah (mis. MSL tetap 18 halaman) karena ruang kosongnya memang sudah disediakan template.

Catatan untuk tim bisnis: di `replay_personal_maml.docx` nama pemegang polis di blok tanda
tangan ditulis **tanpa kurung sudut** ("Name of Policy Holder"), jadi tidak pernah terisi
nama nasabah — perlu diperbaiki menjadi `<Name of Policy Holder>` seperti di template lain.
