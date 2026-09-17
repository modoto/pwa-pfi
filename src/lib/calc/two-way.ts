/**
 * Hitung dua arah antara Uang Pertanggungan dan Premi Dasar.
 *
 * Agen memilih salah satu sebagai dasar hitung; yang satunya dikunci dan diisi
 * otomatis. Rumusnya berbeda per produk dan semuanya diambil dari workbook
 * kalkulator (lihat docs/kalkulator-ilustrasi.md):
 *
 * - **MAME** (`MAME.xlsx`): UP = 150% × premi tahunan × masa pembayaran, jadi
 *   premi tahunan = ROUND(UP / (150% × masa pembayaran)).
 * - **Unit link** (`MAML.xlsm`): UP bukan hasil rumus tunggal melainkan
 *   rentang — `input!E36` menulis batas bawah `MAX(5 × premi tahunan; minimum
 *   produk)` dan `input!E37` batas atas `pengali usia × premi tahunan`.
 *   Yang diisi otomatis adalah **batas bawahnya**, dan batas atas ikut
 *   disebutkan supaya agen tahu ruang yang tersisa.
 *
 * Agen juga bisa memilih **"keduanya"**: hitung otomatis dimatikan dan UP
 * maupun premi diketik sendiri — dipakai bila angkanya sudah ditentukan lain,
 * mis. mengikuti ilustrasi yang sudah ada.
 *
 * - **MSP dan MAMS** (`MSP.xlsm`, `MAMS.xlsm`): premi tahunan = UP / masa
 *   pembayaran (`Illustration!C11`) — di kedua produk ini "uang pertanggungan"
 *   memang total premi yang direncanakan.
 *
 * Produk tanpa rumus tidak memakai hitung dua arah: kedua isian tetap bisa
 * diketik.
 */

import { mameAnnualPremium, mameSumAssured } from "./mame-engine";
import { ropPayMode, ropProductOf } from "./rop-engine";
import { MAML_ASSUMPTIONS } from "./maml-tables";

/**
 * Isian yang jadi dasar hitung. `keduanya` = tanpa hitung otomatis, UP dan
 * premi sama-sama diketik agen.
 */
export type DasarHitung = "uang_pertanggungan" | "premi_dasar" | "keduanya";

export const DASAR_HITUNG: readonly DasarHitung[] = [
  "uang_pertanggungan",
  "premi_dasar",
  "keduanya",
];

export type TwoWayContext = {
  /** Nama produk seperti tersimpan di langkah Rincian Produk. */
  namaProduk: string;
  /** "Unit Link" atau "Tradisional". */
  jenisProduk: string;
  caraBayar: string;
  /** Masa pembayaran dalam tahun. */
  masaBayar: number;
  usiaTertanggung: number;
  /** `min_sum_assured` dari setup produk. */
  minSumAssured: number | null;
};

export type TwoWayHasil = {
  uangPertanggungan?: number;
  premiDasar?: number;
  /** Keterangan rumus, ditampilkan di bawah isian yang dikunci. */
  keterangan: string;
};

/** Berapa kali premi dibayar dalam setahun. */
export function kaliSetahun(caraBayar: string): number {
  const teks = caraBayar.toLowerCase();
  if (teks.includes("sekaligus")) return 1;
  if (teks.includes("bulan")) return 12;
  if (teks.includes("triwulan") || teks.includes("kuartal")) return 4;
  if (teks.includes("semester")) return 2;
  return 1;
}

const rupiah = (nilai: number) => `Rp${Math.round(nilai).toLocaleString("id-ID")}`;

const mame = (ctx: TwoWayContext) => /maksima edukasi/i.test(ctx.namaProduk);
/** MSP dan MAMS memakai rumus yang sama. */
const rop = (ctx: TwoWayContext) => ropProductOf(ctx.namaProduk) !== null;
const unitLink = (ctx: TwoWayContext) => ctx.jenisProduk === "Unit Link";

/** Pengali UP maksimal menurut usia tertanggung (`Assumption!H5:J17` MAML.xlsm). */
export function mamlSaMultiplier(usia: number): number {
  const baris = MAML_ASSUMPTIONS.saMultiplier.find(
    ([bawah, atas]) => usia >= bawah && usia <= atas
  );
  return baris?.[2] ?? 0;
}

/** UP minimal unit link: 5 × premi tahunan, tapi tidak kurang dari minimum produk. */
const MAML_PENGALI_MINIMUM = 5;

/** Apakah produk ini punya rumus dua arah. */
export function duaArahTersedia(ctx: TwoWayContext): boolean {
  if (mame(ctx) || rop(ctx)) return ctx.masaBayar > 0;
  if (unitLink(ctx)) return true;
  return false;
}

/**
 * Hitung sisi yang dikunci.
 *
 * @param dasar isian yang diketik agen; hasilnya untuk isian satunya.
 * @param nilai isian saat ini (angka polos, tanpa pemisah ribuan).
 */
export function hitungDuaArah(
  ctx: TwoWayContext,
  dasar: DasarHitung,
  nilai: { uangPertanggungan: number; premiDasar: number }
): TwoWayHasil | null {
  // Tanpa hitung otomatis: tidak ada sisi yang perlu diisi.
  if (dasar === "keduanya") return null;
  if (!duaArahTersedia(ctx)) return null;

  const kali = kaliSetahun(ctx.caraBayar);
  const premiTahunan = nilai.premiDasar * kali;

  if (mame(ctx)) {
    const keterangan =
      `UP = 150% × premi tahunan × masa pembayaran ${ctx.masaBayar} tahun (MAME.xlsx).`;

    if (dasar === "premi_dasar") {
      return { uangPertanggungan: mameSumAssured(premiTahunan, ctx.masaBayar), keterangan };
    }

    const tahunan = mameAnnualPremium(nilai.uangPertanggungan, ctx.masaBayar);
    return { premiDasar: Math.round(tahunan / kali), keterangan };
  }

  if (rop(ctx)) {
    // Cara bayar bulanan tetap memakai premi tahunan / 12 (`Index!J3`).
    const kaliMsp = ropPayMode(ctx.caraBayar) === "Monthly" ? 12 : 1;
    const keterangan =
      `Premi tahunan = UP ÷ masa pembayaran ${ctx.masaBayar} tahun (workbook produk)` +
      (kaliMsp > 1 ? ", dibagi 12 pembayaran per tahun." : ".");

    if (dasar === "premi_dasar") {
      return {
        uangPertanggungan: Math.round(nilai.premiDasar * kaliMsp * ctx.masaBayar),
        keterangan,
      };
    }
    return {
      premiDasar: Math.round(nilai.uangPertanggungan / ctx.masaBayar / kaliMsp),
      keterangan,
    };
  }

  // Unit link: UP berupa rentang; yang diisi otomatis adalah batas bawahnya.
  const pengali = mamlSaMultiplier(ctx.usiaTertanggung);
  const batasAtas = (premi: number) => (pengali > 0 ? pengali * premi * kali : 0);

  if (dasar === "premi_dasar") {
    const minimum = Math.max(
      MAML_PENGALI_MINIMUM * premiTahunan,
      ctx.minSumAssured ?? 0
    );
    const atas = batasAtas(nilai.premiDasar);

    return {
      uangPertanggungan: Math.round(minimum),
      keterangan:
        `UP minimal ${MAML_PENGALI_MINIMUM} × premi tahunan` +
        (ctx.minSumAssured ? ` dan tidak kurang dari ${rupiah(ctx.minSumAssured)}` : "") +
        (atas > 0
          ? `; maksimal ${pengali} × premi tahunan = ${rupiah(atas)} untuk usia ${ctx.usiaTertanggung} tahun.`
          : "."),
    };
  }

  const tahunan = nilai.uangPertanggungan / MAML_PENGALI_MINIMUM;
  return {
    premiDasar: Math.round(tahunan / kali),
    keterangan:
      `Premi tahunan = UP ÷ ${MAML_PENGALI_MINIMUM} (batas UP minimal di MAML.xlsm)` +
      (kali > 1 ? `, dibagi ${kali} pembayaran per tahun.` : "."),
  };
}
