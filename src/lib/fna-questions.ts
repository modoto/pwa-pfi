/**
 * Kuesioner FnA per topik prioritas.
 *
 * Baru topik "Perlindungan Pendapatan" yang desainnya tersedia; tiga topik
 * lain sengaja dibiarkan kosong dan halamannya menampilkan pemberitahuan,
 * bukan pertanyaan karangan sendiri.
 *
 * `key` tiap pertanyaan disimpan di kolom `pertanyaan` tabel
 * `lead_fna_answers`, jadi jangan diubah setelah ada data — teksnya boleh.
 */

export type FnaQuestion = {
  key: string;
  text: string;
  options: string[];
};

const NOMINAL_UP = [
  "<IDR 100 Juta",
  "IDR 100 Juta – IDR 500 Juta",
  "IDR 500 Juta – IDR 1 Milyar",
  ">IDR 1 Milyar",
];

const PERLINDUNGAN_PENDAPATAN: FnaQuestion[] = [
  {
    key: "waktu-produktif",
    text: "Berapa lama waktu produktif anda untuk bekerja mencari nafkah bagi keluarga?",
    options: ["> 15 Tahun", "5 – 10 Tahun", "10 – 15 Tahun"],
  },
  {
    key: "pengeluaran-rutin",
    text: "Berapakah pengeluaran rutin bulanan keluarga saat ini?",
    options: [
      "Kebutuhan Dana <IDR 10 Juta Per Bulan",
      "Kebutuhan Dana >IDR 50 Juta Per Bulan",
      "Kebutuhan Dana IDR 10 Juta – IDR 25 Juta Per Bulan",
      "Kebutuhan Dana IDR 25 Juta – IDR 50 Juta Per Bulan",
    ],
  },
  {
    key: "up-dibutuhkan",
    text: "Berapakah Uang Pertanggungan Asuransi Jiwa yang dibutuhkan saat ini?",
    options: NOMINAL_UP,
  },
  {
    key: "dana-tersedia",
    text: "Berapakah Dana Darurat dan Uang Pertanggungan asuransi Jiwa yang telah tersedia saat ini? (Tabungan, Deposito, dll)",
    options: NOMINAL_UP,
  },
  {
    key: "sisihan-per-tahun",
    text: "Berapakah dana yang dapat Bapak/Ibu sisihkan per tahun untuk Dana Hari Tua ini?",
    options: [
      "<IDR 25 Juta",
      "IDR 25 Juta – IDR 50 Juta",
      "IDR 50 Juta – IDR 100 Juta",
      "IDR 100 Juta – IDR 500 Juta",
      ">IDR 500 Juta",
    ],
  },
  {
    key: "manfaat-dibutuhkan",
    text: "Apa manfaat asuransi yang Anda butuhkan saat ini?",
    options: [
      "Asuransi Jiwa",
      "Asuransi Kesehatan",
      "Asuransi Kecelakaan Diri",
      "Asuransi Penyakit Kritis",
      "Lainnya",
    ],
  },
];

/**
 * Kuesioner Profil Risiko — satu langkah tersendiri sesudah semua prioritas,
 * bukan milik salah satu topik. Jawabannya tetap disimpan di
 * `lead_fna_answers` dengan `topik` = key di bawah ini.
 */
export const RISK_PROFILE_KEY = "profil-risiko";

/*
 * Pertanyaan Kuesioner Profil Risiko tidak lagi ditulis di sini: sejak
 * 2026-09-16 diambil dari master RPQ lokal (`rpq_config_questions` +
 * `rpq_config_answers`), lengkap dengan bobot skor tiap jawaban — lihat
 * src/lib/risk-profile-score.ts.
 */

export const FNA_QUESTIONS: Record<string, FnaQuestion[]> = {
  "perlindungan-pendapatan": PERLINDUNGAN_PENDAPATAN,
  "pendidikan-anak": [],
  "dana-pensiun": [],
  "rencana-warisan": [],
};

export const questionsOf = (topicKey: string): FnaQuestion[] => FNA_QUESTIONS[topicKey] ?? [];
