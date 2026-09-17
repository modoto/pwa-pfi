/**
 * Data statis alur Sales Illustration.
 *
 * Baru langkah pertama ("Rincian PP dan CT") yang ada desainnya; tujuh langkah
 * lain sudah terdaftar di sini supaya stepper-nya utuh seperti desain.
 */

import { Building2, User, Users } from "lucide-react";

export type IllustrationStep = {
  slug: string;
  label: string;
};

/** Urutan dan judul langkah, persis seperti stepper di desain. */
export const ILLUSTRATION_STEPS: IllustrationStep[] = [
  { slug: "policy-holder", label: "Rincian PP dan CT" },
  { slug: "product", label: "Rincian Produk" },
  { slug: "rider", label: "Rider" },
  { slug: "risk-profile", label: "Kuesioner Profil Resiko" },
  { slug: "investment", label: "Pilihan Investasi" },
  { slug: "quotation", label: "Kutipan Ilustrasi" },
  { slug: "riplay", label: "Riplay Personal" },
  { slug: "signature", label: "Tanda Tangan" },
];

export const stepBySlug = (slug: string) =>
  ILLUSTRATION_STEPS.find((step) => step.slug === slug) ?? null;

/**
 * Dua langkah ini hanya berlaku untuk produk unit link: produk tradisional
 * tidak punya dana investasi, jadi profil risiko dan pilihan dananya tidak
 * ditanyakan. Kuesioner Profil Risiko di alur FnA tidak terpengaruh.
 */
export const LANGKAH_UNIT_LINK = ["risk-profile", "investment"] as const;

export const produkTradisional = (jenisProduk: string | undefined) =>
  jenisProduk === "Tradisional";

/** Langkah yang tampil untuk satu jenis produk. */
export function stepsUntukProduk(jenisProduk: string | undefined): IllustrationStep[] {
  if (!produkTradisional(jenisProduk)) return ILLUSTRATION_STEPS;

  const dilewati: readonly string[] = LANGKAH_UNIT_LINK;
  return ILLUSTRATION_STEPS.filter((step) => !dilewati.includes(step.slug));
}

/** Slug langkah sesudah / sebelum `slug`; null bila sudah di ujung. */
export function langkahTetangga(
  slug: string,
  jenisProduk: string | undefined,
  arah: 1 | -1
): string | null {
  const daftar = stepsUntukProduk(jenisProduk);
  const index = daftar.findIndex((step) => step.slug === slug);
  if (index < 0) return null;
  return daftar[index + arah]?.slug ?? null;
}

/** Tiga pilihan "Tujuan Ilustrasi" di langkah pertama. */
export const ILLUSTRATION_PURPOSES = [
  {
    key: "diri-sendiri",
    title: "Diri Sendiri",
    description: "Membeli untuk diri sendiri",
    icon: User,
  },
  {
    key: "keluarga",
    title: "Keluarga",
    description: "Anak, Istri, Suami, Orang tua dll",
    icon: Users,
  },
  {
    key: "perusahaan",
    title: "Perusahaan",
    description: "Pemegang Polis Lembaga / Badan usaha",
    icon: Building2,
  },
] as const;

export const JENIS_KELAMIN = ["Laki-Laki", "Perempuan"] as const;
export const STATUS_MEROKOK = ["Bukan Perokok", "Perokok"] as const;

export const JENIS_PRODUK = ["Unit Link", "Tradisional"] as const;

/** Pilihan "Pada Tahun ke-" untuk top up dan penarikan. */
export const TAHUN_KE = Array.from({ length: 30 }, (_, index) => String(index + 1));

// Status perkawinan, pekerjaan, tujuan asuransi, mata uang, cara bayar, masa,
// dan rider dibaca dari master data lokal (lihat src/lib/db/master-repo.ts).
// Hubungan dengan pemegang polis belum punya master, jadi masih statis.
export const HUBUNGAN_PEMEGANG_POLIS = [
  "Anak",
  "Istri",
  "Suami",
  "Orang Tua",
  "Saudara Kandung",
  "Lainnya",
] as const;

/**
 * Sebelas butir pernyataan pada langkah Tanda Tangan, disalin apa adanya dari
 * desain. Nama produk pada butir ke-8 ikut aslinya ("Mega Prima Link") — perlu
 * dikonfirmasi apakah seharusnya mengikuti produk yang dipilih.
 */
export const PERNYATAAN_ILUSTRASI = [
  "Ilustrasi ini hanya merupakan suatu asumsi atau contoh dan bukan merupakan kondisi atau perhitungan yang sebenarnya. Ilustrasi ini bukan merupakan perjanjian asuransi antara PT PFI Mega Life Insurance dengan Calon Pemegang Polis serta bukan merupakan bukti kepesertaan atas produk asuransi apapun yang diterbitkan oleh PT PFI Mega Life Insurance.",
  "Data, informasi dan keterangan lain yang disampaikan kepada Penanggung adalah benar dan tidak bersifat rahasia serta dapat digunakan untuk tujuan pemrosesan ilustrasi ini.",
  "Calon Pemegang Polis menyatakan setuju bahwa pada setiap saat Penanggung dapat menggunakan dan mengungkapkan informasi atau keterangan yang diberikan untuk kepentingan usahanya, termasuk namun tidak terbatas untuk mengungkapkan informasi kepada pihak ketiga manapun, baik yang berlokasi di dalam maupun di luar Negara Republik Indonesia, termasuk kepada penyedia jasa dan perusahaan-perusahaan lainnya dalam kelompok usaha Penanggung.",
  "Syarat dan ketentuan serta pengecualian yang berlaku terhadap Produk Asuransi ini akan dituangkan dalam Polis yang akan diterbitkan oleh PT PFI Mega Life Insurance.",
  "Pemegang Polis diberikan waktu untuk mempelajari Polis selama 14 (empat belas) hari kalender terhitung sejak Polis diterima oleh Pemegang Polis.",
  "Nilai Investasi adalah nilai dari saldo unit yang dihitung berdasarkan harga unit pada saat tertentu.",
  "Perubahan harga unit menggambarkan hasil investasi dari dana investasi. Kinerja dari investasi tidak dijamin tergantung dari risiko masing-masing dana investasi. Pemegang Polis diberi keleluasaan untuk menempatkan alokasi dana investasi yang memungkinkan optimalisasi tingkat pengembalian investasi, sesuai dengan kebutuhan dan profil risiko Pemegang Polis. Semua risiko, kerugian dan manfaat yang timbul dari investasi atas dana investasi menjadi tanggung jawab Pemegang Polis sepenuhnya.",
  "Memiliki Polis asuransi jiwa merupakan komitmen jangka panjang. Mega Prima Link adalah suatu produk asuransi jiwa yang dikaitkan dengan investasi. Untuk dapat menikmati manfaat Polis ini, Kami sarankan Anda untuk melakukan pembayaran Premi selama Masa Asuransi.",
  "Penawaran ini hanya berlaku selama jangka waktu 30 (tiga puluh) hari sejak tanggal diterbitkan.",
  "PT PFI Mega Life Insurance terdaftar dan diawasi oleh Otoritas Jasa Keuangan (OJK).",
  "Saya telah mendapatkan penjelasan dan memahami mengenai Ringkasan Informasi Produk dan/atau Layanan Asuransi, kinerja investasi setidak-tidaknya 5 (lima) tahun terakhir dari dana investasi yang saya pilih melalui Laporan Kinerja Investasi (jika ada), dan ilustrasi manfaat baik manfaat asuransi dan manfaat investasi (jika ada) sesuai pilihan saya.",
] as const;
