/**
 * Mesin ilustrasi produk manfaat tahapan (return of premium):
 * **Mega Saving Protection (MSP)** dan **Mega Asuransi Maksima Solusi (MAMS)**.
 *
 * Terjemahan sheet `Illustration` dan `ROP_Rates` pada src/calculators/MSP.xlsm
 * dan MAMS.xlsm — rumus keduanya sama persis, dan per 2026-09-17 tabel
 * tarifnya pun identik (dicek ulang tiap kali `npm run rop:tables` dijalankan):
 *
 *   premi tahunan        = UP / masa pembayaran  (`Illustration!C11`)
 *   akumulasi premi      = jumlah premi sampai tahun polis itu
 *   manfaat tahapan      = ROUNDUP(faktor tahun × akumulasi premi; ribuan)
 *   meninggal biasa      = 200% × akumulasi premi (`Illustration!J11`)
 *   meninggal kecelakaan = 400% × akumulasi premi (dari teks RIPLAY)
 *
 * Jadwal manfaat tahapan (`ROP_Rates!C6`) membayar lima kali: dua kali 50% pada
 * empat dan tiga tahun sebelum masa asuransi berakhir, lalu tiga kali sisanya
 * masing-masing `ROUNDDOWN((persentase − 100%) / 3)` pada tiga tahun terakhir.
 * Totalnya = persentase manfaat tahapan × total premi.
 *
 * Nilai tunai (`Illustration!H`/`I`) belum di-port: faktornya ada di sheet
 * `CV_table` yang formulanya memakai INDIRECT ke tabel bernama, dan nilainya
 * tersimpan sebagai #N/A di workbook.
 */

import { ROP_RATES } from "./rop-tables";

/** Produk yang memakai mesin ini. */
export type RopProduct = "msp" | "mams";

export type RopPayMode = "Monthly" | "Yearly";

export type RopInput = {
  /** Usia masuk tertanggung. */
  insuredAge: number;
  /** Uang pertanggungan / total premi yang direncanakan (`Sum_Insured`). */
  sumInsured: number;
  /** Masa asuransi, 15–20 tahun. */
  policyTerm: number;
  /** Masa pembayaran premi, 7–10 tahun. */
  premiumTerm: number;
  payMode: RopPayMode;
};

export type RopYear = {
  policyYear: number;
  insuredAge: number;
  annualPremium: number;
  accumulatedPremium: number;
  survivalBenefit: number;
  accumulatedSurvivalBenefit: number;
  /** 200% akumulasi premi. */
  deathBenefit: number;
  /** 400% akumulasi premi. */
  accidentalDeathBenefit: number;
};

export type RopProjection = {
  annualPremium: number;
  /** Premi per bulan bila cara bayarnya bulanan; null bila tahunan. */
  monthlyPremium: number | null;
  totalPremium: number;
  /** Persentase manfaat tahapan (mis. 1,15 = 115%); null bila kombinasinya tidak ada. */
  survivalBenefitRate: number | null;
  totalSurvivalBenefit: number;
  /** Tahun polis yang membayar manfaat tahapan (lima tahun terakhir). */
  tahunTahapan: number[];
  /** Manfaat tahapan pembayaran ke-3 sampai ke-5 (tiga tahun terakhir). */
  sisaTahapan: number;
  years: RopYear[];
  warnings: string[];
};

/** Produk dari nama yang tersimpan di langkah Rincian Produk; null bila bukan keduanya. */
export function ropProductOf(namaProduk: string | undefined): RopProduct | null {
  const nama = namaProduk ?? "";
  if (/saving protection|\bmsp\b/i.test(nama)) return "msp";
  if (/maksima solusi|\bmams\b/i.test(nama)) return "mams";
  return null;
}

/** "Bulanan" → Monthly; selain itu Yearly (workbook hanya punya dua mode). */
export const ropPayMode = (caraBayar: string): RopPayMode =>
  /bulan/i.test(caraBayar) ? "Monthly" : "Yearly";

const tabel = (product: RopProduct, payMode: RopPayMode) =>
  ROP_RATES[product][payMode] as readonly {
    ageLb: number;
    ageUb: number;
    policyTerm: number;
    rates: Record<string, number>;
  }[];

/** Persentase manfaat tahapan; null bila kombinasinya tidak dijual. */
export function ropSurvivalRate(product: RopProduct, input: RopInput): number | null {
  const baris = tabel(product, input.payMode).find(
    (row) =>
      row.policyTerm === input.policyTerm &&
      input.insuredAge >= row.ageLb &&
      input.insuredAge <= row.ageUb
  );
  return baris?.rates[String(input.premiumTerm)] ?? null;
}

/** Masa asuransi yang tersedia di workbook (15–20 tahun). */
export function ropPolicyTerms(product: RopProduct, payMode: RopPayMode): number[] {
  return [...new Set(tabel(product, payMode).map((row) => row.policyTerm))].sort((a, b) => a - b);
}

/** Masa pembayaran yang tersedia untuk satu masa asuransi. */
export function ropPremiumTerms(
  product: RopProduct,
  payMode: RopPayMode,
  policyTerm: number
): number[] {
  const masa = new Set<number>();
  for (const row of tabel(product, payMode)) {
    if (policyTerm && row.policyTerm !== policyTerm) continue;
    for (const kunci of Object.keys(row.rates)) masa.add(Number(kunci));
  }
  return [...masa].sort((a, b) => a - b);
}

/** ROUNDUP(nilai; -3) di Excel: dibulatkan ke atas ke ribuan terdekat. */
const keRibuan = (nilai: number) => Math.ceil(nilai / 1000) * 1000;

/**
 * Faktor manfaat tahapan satu tahun polis (`ROP_Rates!C6`):
 * 50% pada tahun ke-(masa − 4) dan ke-(masa − 3), lalu sisanya dibagi tiga
 * pada tiga tahun terakhir.
 */
export function ropSurvivalFactor(policyYear: number, policyTerm: number, rate: number): number {
  if (policyYear <= policyTerm && policyYear >= policyTerm - 2) {
    // ROUNDDOWN((rate - 100%) / 3, 8)
    return Math.floor(((rate - 1) / 3) * 1e8) / 1e8;
  }
  if (policyTerm - policyYear === 4 || policyTerm - policyYear === 3) return 0.5;
  return 0;
}

export function projectRop(product: RopProduct, input: RopInput): RopProjection {
  const warnings: string[] = [];
  const rate = ropSurvivalRate(product, input);

  // `Illustration!C11`: premi nol bila masa bayar di bawah 7 tahun.
  const annualPremium =
    input.premiumTerm >= 7 ? Math.round(input.sumInsured / input.premiumTerm) : 0;

  if (input.premiumTerm < 7) warnings.push("Masa pembayaran premi minimal 7 tahun.");
  if (input.insuredAge + input.policyTerm > 70) {
    warnings.push("Usia tertanggung di akhir masa asuransi tidak boleh lebih dari 70 tahun.");
  }
  if (rate === null) {
    warnings.push(
      `Kombinasi masa asuransi ${input.policyTerm} tahun dan masa pembayaran ${input.premiumTerm} tahun tidak ada di tabel produk.`
    );
  }

  const years: RopYear[] = [];
  let accumulated = 0;
  let accumulatedSurvival = 0;

  for (let t = 1; t <= input.policyTerm; t++) {
    const premi = t <= input.premiumTerm ? annualPremium : 0;
    accumulated += premi;

    const faktor = rate === null ? 0 : ropSurvivalFactor(t, input.policyTerm, rate);
    const tahapan = faktor > 0 ? keRibuan(faktor * accumulated) : 0;
    accumulatedSurvival += tahapan;

    years.push({
      policyYear: t,
      insuredAge: input.insuredAge + t - 1,
      annualPremium: premi,
      accumulatedPremium: accumulated,
      survivalBenefit: tahapan,
      accumulatedSurvivalBenefit: accumulatedSurvival,
      deathBenefit: 2 * accumulated,
      accidentalDeathBenefit: 4 * accumulated,
    });
  }

  const tahunTahapan = years
    .filter((tahun) => tahun.survivalBenefit > 0)
    .map((tahun) => tahun.policyYear);

  // Pembayaran ke-3 sampai ke-5 = tiga tahun terakhir masa asuransi.
  const sisaTahapan = years
    .filter((tahun) => tahun.policyYear > input.policyTerm - 3)
    .reduce((jumlah, tahun) => jumlah + tahun.survivalBenefit, 0);

  return {
    annualPremium,
    monthlyPremium: input.payMode === "Monthly" ? Math.round(annualPremium / 12) : null,
    totalPremium: annualPremium * input.premiumTerm,
    survivalBenefitRate: rate,
    totalSurvivalBenefit: accumulatedSurvival,
    tahunTahapan,
    sisaTahapan,
    years,
    warnings,
  };
}
