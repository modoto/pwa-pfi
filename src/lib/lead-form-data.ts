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

/** Hitung usia dalam tahun penuh dari tanggal lahir (format input date: yyyy-mm-dd). */
export function hitungUsia(tanggalLahir: string): string {
  if (!tanggalLahir) return "";

  const lahir = new Date(tanggalLahir);
  if (Number.isNaN(lahir.getTime())) return "";

  const sekarang = new Date();
  let usia = sekarang.getFullYear() - lahir.getFullYear();

  const belumUlangTahun =
    sekarang.getMonth() < lahir.getMonth() ||
    (sekarang.getMonth() === lahir.getMonth() && sekarang.getDate() < lahir.getDate());
  if (belumUlangTahun) usia -= 1;

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
