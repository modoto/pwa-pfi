/**
 * Konten produk yang **tidak** ada di API.
 *
 * Daftar produknya sendiri dibaca dari tabel lokal `products` hasil penarikan
 * `GetAllProduct` (lihat `listProducts` di src/lib/db/master-repo.ts). Yang
 * tertinggal di sini hanya materi pemasaran dari desain: teks "Ilustrasi
 * Manfaat" per produk dan disclaimer.
 *
 * Foto tiap produk belum diekspor dari Figma; sampai ada, kartu memakai blok
 * berwarna dengan ikon menurut jenis produk (lihat ProductIcon).
 */

import type { MasterProduct } from "@/lib/db/master-repo";

/** Jenis produk di API ditulis "UnitLink"; di layar "Unit Link". */
export const JENIS_PRODUK_API: Record<string, string> = {
  UnitLink: "Unit Link",
  Tradisional: "Tradisional",
};

export const jenisProduk = (product: Pick<MasterProduct, "product_type">) =>
  JENIS_PRODUK_API[product.product_type ?? ""] ?? product.product_type ?? "–";

/**
 * Nama tampilan: nama pemasaran (`description`, mis. "Mega Asuransi Maksima
 * Link") diikuti nama varian (`product_name`, mis. "MAML Regular"). Nama
 * varian perlu ikut karena beberapa produk berbagi nama pemasaran yang sama —
 * MAME REGULAR dan MAME SINGLE sama-sama "Mega Asuransi Maksima Edukasi".
 */
export function namaProduk(product: Pick<MasterProduct, "description" | "product_name">): string {
  const pemasaran = product.description?.trim();
  const varian = product.product_name?.trim();

  if (pemasaran && varian) return `${pemasaran} (${varian})`;
  return pemasaran || varian || "Produk tanpa nama";
}

export type ProductIllustration = {
  paragraphs: string[];
  /** Rincian di kotak biru. */
  highlights: string[];
};

/**
 * Isi "Ilustrasi Manfaat" per kode produk (`product_code`). Baru satu yang ada
 * di desain; kodenya 220 = MAML Regular (Mega Asuransi Maksima Link), karena
 * baris brosur di desain menyebut produk itu — walau cerita di dalamnya
 * menyebut "MSP", jadi perlu dikonfirmasi.
 */
export const PRODUCT_ILLUSTRATIONS: Record<string, ProductIllustration> = {
  "220": {
    paragraphs: [
      "Menginginkan Target Tahapan pendidikan atau dana pensiun sebesar Rp 1 milyar di tahun ke- 11 sampai dengan 15 dimana dibutuhkan komitmen Premi Tahunan kurang dari Rp 125 juta selama 7 tahun.",
      "Pendekatan ini memungkinkan Pak Arief menerima Dana Tahapan Pasti yang dapat digunakan untuk pendidikan anak-anaknya dan menabung untuk masa depannya sebagai dana pensiun sekaligus memberikan perlindungan jiwa seandainya iya meninggal dunia.",
    ],
    highlights: [
      "Pak Arief menggunakan MSP.",
      "Pak Arief di usia 35 tahun membayar premi tahunan kurang dari Rp 125 juta selama 7 tahun.",
      "Total premi yang dibayarkan oleh Pak Arief sebesar Rp 869 jutaan dengan nantinya mendapatkan Total Dana Tahapan Pasti sebesar Rp 1 milyar.",
      "Pak Arief akan mulai menerima Dana Tahapan Pasti sebesar Rp 434 jutaan di usia 46 tahun dan 47 tahun serta Rp 43 jutaan di usia Pak Arief yang ke 48, 49 dan 50 tahun.",
    ],
  },
};

/**
 * Disclaimer di dasar halaman detail produk — sama untuk semua produk,
 * disalin apa adanya dari desain.
 */
export const PRODUCT_DISCLAIMER =
  "Analisis Kebutuhan Keuangan ini dibuat oleh PT PFI Mega Life Insurance untuk produk-produk " +
  "yang ditanggung oleh PT PFI Mega Life Insurance. Materi pemasaran elektronik ini disajikan " +
  "hanya sebagai informasi umum dan tidak berkaitan dengan tujuan investasi spesifik dari " +
  "masing-masing nasabah. Proyeksi yang disampaikan hanya merupakan ilustrasi. Kinerja dana di " +
  "masa lalu tidak menjadi jaminan kinerja di masa depan. Syarat dan ketentuan yang berlaku akan " +
  "dijelaskan secara rinci dalam polis. Rencana pembelian produk asuransi jiwa adalah komitmen " +
  "jangka panjang. Pemberhentian komitmen kontrak polis lebih awal dari masa yang telah " +
  "ditentukan sebelumnya akan menimbulkan biaya tinggi. Anda dapat meminta saran dari penasehat " +
  "keuangan Anda sebelum berkomitmen untuk membeli produk atau anda dapat menghubungi layanan " +
  "pelanggan kami untuk pertanyaan lebih lanjut.";
