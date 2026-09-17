/**
 * Pilihan untuk form Tambah Lead.
 *
 * Semua daftar di bawah masih data contoh — swagger belum punya endpoint lead
 * maupun master cabang / sumber, jadi nanti tinggal ditukar pemanggilan API.
 */

export const KODE_CABANG = ["KCP BLITAR", "KCP MALANG", "KC SURABAYA", "KCP KEDIRI"] as const;

export const SUMBER_LEAD = [
  "MCMS - Mega First",
  "Bank Staff",
  "Natural Market",
  "Walk In",
] as const;

export type BankStaff = {
  /** Nomor induk pegawai — kolom "NIP" pada modal pemilih. */
  code: string;
  name: string;
};

export const BANK_STAFF: BankStaff[] = [
  { code: "AG0001", name: "Budi Santoso" },
  { code: "AG0002", name: "Sari Oktaviani" },
  { code: "AG0003", name: "Andi Wijaya" },
  { code: "AG0004", name: "Rina Marlina" },
  { code: "AG0005", name: "Dedi Gunawan" },
  { code: "AG0006", name: "Maya Putri Lestari" },
  { code: "AG0007", name: "Joko Prabowo" },
  { code: "AG0008", name: "Nia Ramadhani" },
  { code: "AG0009", name: "Tommy Herlambang" },
  { code: "AG0010", name: "Fitriani Azzahra" },
];

/** Enam komponen penilaian yang membentuk skor prediksi. */
export const SKOR_FIELDS = [
  { key: "pekerjaan", label: "Pekerjaan" },
  { key: "rumah", label: "Rumah" },
  { key: "sekolah", label: "Sekolah" },
  { key: "anak", label: "Anak" },
  { key: "kendaraan", label: "Kendaraan" },
  { key: "asuransi", label: "Asuransi" },
] as const;

export type SkorKey = (typeof SKOR_FIELDS)[number]["key"];

const SEHARI = 24 * 60 * 60 * 1000;

/** Tengah hari UTC, supaya selisih hari tidak terpengaruh zona waktu. */
const hariUtc = (tahun: number, bulan: number, tanggal: number) =>
  Date.UTC(tahun, bulan, tanggal, 12);

/**
 * Usia menurut **ulang tahun terdekat** (nearest birthday), bukan ulang tahun
 * terakhir: bila jarak dari ulang tahun terakhir sudah lewat setengah tahun,
 * usianya dibulatkan ke atas.
 *
 * Rumusnya menyalin kalkulator produk (MSL.xlsm / MAML.xlsm `input!E16`):
 *
 *     DATEDIF(DoB; Tanggal; "Y") + IF(DATEDIF(DoB; Tanggal; "yd") > 365/2; 1)
 *
 * Contoh: lahir 2 Oktober 1990, dihitung 16 September 2026 → 35 tahun 349 hari
 * → **36 tahun**. Nilai ini yang dipakai seluruh aplikasi, termasuk masukan
 * mesin proyeksi dan pemeriksaan batas usia produk, supaya hasilnya sama
 * dengan workbook.
 *
 * Catatan: `age` yang dikirim API lead memakai ulang tahun terakhir, jadi
 * bisa berbeda satu tahun dengan angka di sini.
 *
 * @param tanggalLahir format input date (yyyy-mm-dd)
 * @param pada tanggal acuan; bawaannya hari ini
 */
export function hitungUsia(tanggalLahir: string, pada: Date = new Date()): string {
  if (!tanggalLahir) return "";

  const lahir = new Date(tanggalLahir);
  if (Number.isNaN(lahir.getTime())) return "";

  const [tahunLahir, bulanLahir, tanggalLahirHari] = [
    lahir.getUTCFullYear(),
    lahir.getUTCMonth(),
    lahir.getUTCDate(),
  ];

  const acuan = hariUtc(pada.getFullYear(), pada.getMonth(), pada.getDate());

  // Tahun penuh (DATEDIF "Y").
  let usia = pada.getFullYear() - tahunLahir;
  if (acuan < hariUtc(pada.getFullYear(), bulanLahir, tanggalLahirHari)) usia -= 1;

  // Sisa hari sejak ulang tahun terakhir (DATEDIF "yd").
  const ulangTahunTerakhir = hariUtc(tahunLahir + usia, bulanLahir, tanggalLahirHari);
  const sisaHari = Math.floor((acuan - ulangTahunTerakhir) / SEHARI);
  if (sisaHari > 365 / 2) usia += 1;

  return usia >= 0 && usia < 130 ? String(usia) : "";
}

/**
 * Skor prediksi = rata-rata enam komponen di atas, satu angka di belakang koma.
 * Rumus sebenarnya belum ada di desain maupun API — ini asumsi sementara.
 */
export function hitungSkorPrediksi(nilai: Record<SkorKey, string>): string {
  const angka = SKOR_FIELDS.map(({ key }) => Number.parseFloat(nilai[key]));
  if (angka.some((n) => Number.isNaN(n))) return "";

  const rata = angka.reduce((total, n) => total + n, 0) / angka.length;
  return rata.toFixed(1);
}
