/**
 * Mesin ilustrasi Mega Asuransi Maksima Edukasi (MAME).
 *
 * Terjemahan sheet "Yearly Basis Calc" pada src/calculators/MAME.xlsx:
 *
 *   premi tahunan  = ROUND(UP / (150% × masa bayar))
 *   akumulasi      = jumlah premi tahunan sampai tahun polis itu
 *   meninggal      = 150% × akumulasi
 *   kecelakaan     = 300% × akumulasi
 *   nilai tunai    = faktor NT (bulan ke-12 × tahun, usia PP) × akumulasi;
 *                    nol di tahun terakhir karena diganti beasiswa
 *   beasiswa       = tarif beasiswa × akumulasi, hanya di tahun terakhir
 *
 * Semua tarif dicari menurut **usia pemegang polis** (produk pendidikan:
 * orang tua sebagai pemegang polis), cara bayar, masa asuransi, dan masa bayar.
 *
 * Satu keanehan workbook tidak ditiru: sel beasiswa baris tahun ke-6
 * (`E12`) merujuk baris tahun ke-7, dan sel tahun ke-7 kosong, sehingga untuk
 * masa asuransi 7 tahun beasiswanya tampil setahun lebih awal. Di sini
 * beasiswa selalu di tahun terakhir, sesuai kalimat di RIPLAY.
 */

import { MAME_TABLES } from "./mame-tables";

export type MamePayMode = "Monthly" | "Yearly";

export type MameInput = {
  /** Usia pemegang polis saat polis terbit. */
  policyHolderAge: number;
  sumAssured: number;
  /** 7 atau 10 tahun. */
  policyTerm: number;
  /** 1 (sekaligus), 2, atau 3 tahun. */
  premiumTerm: number;
  payMode: MamePayMode;
};

export type MameYear = {
  policyYear: number;
  annualPremium: number;
  accumulatedPremium: number;
  maturityBenefit: number;
  /** null di tahun terakhir (tidak ada nilai tunai, diganti beasiswa). */
  cashValue: number | null;
  deathBenefit: number;
  accidentalDeathBenefit: number;
};

export type MameProjection = {
  annualPremium: number;
  /** Premi per bulan untuk cara bayar bulanan; null bila tahunan/sekaligus. */
  monthlyPremium: number | null;
  totalPremium: number;
  maturityRate: number | null;
  years: MameYear[];
  /** Pelanggaran ketentuan produk yang tertulis di workbook. */
  warnings: string[];
};

/** "Bulanan" → Monthly; tahunan dan sekaligus → Yearly (catatan workbook: single = Yearly). */
export const mamePayMode = (caraBayar: string): MamePayMode =>
  /bulan/i.test(caraBayar) ? "Monthly" : "Yearly";

/** Premi tahunan dari UP: ROUND(UP / (150% × masa bayar)). */
export const mameAnnualPremium = (sumAssured: number, premiumTerm: number) =>
  premiumTerm > 0 ? Math.round(sumAssured / (1.5 * premiumTerm)) : 0;

/** Kebalikannya, untuk hitung dua arah: UP = 150% × premi tahunan × masa bayar. */
export const mameSumAssured = (annualPremium: number, premiumTerm: number) =>
  Math.round(1.5 * annualPremium * premiumTerm);

function maturityRate(input: MameInput): number | null {
  const row = MAME_TABLES.maturity[input.payMode].find(
    (item) =>
      item.policyTerm === input.policyTerm &&
      input.policyHolderAge >= item.ageLb &&
      input.policyHolderAge <= item.ageUb
  );
  const rates = row?.rates as Record<string, number> | undefined;
  return rates?.[String(input.premiumTerm)] ?? null;
}

function cashValueFactor(input: MameInput, policyYear: number): number | null {
  const tabel = MAME_TABLES.cashValue[input.payMode] as Record<string, readonly (readonly number[])[]>;
  const baris = tabel[`${input.policyTerm}-${input.premiumTerm}`]?.[policyYear - 1];
  return baris?.[input.policyHolderAge - MAME_TABLES.cashValueFirstAge] ?? null;
}

export function projectMame(input: MameInput): MameProjection {
  const warnings: string[] = [];
  const annualPremium = mameAnnualPremium(input.sumAssured, input.premiumTerm);
  const totalPremium = annualPremium * input.premiumTerm;

  // Ketentuan di sheet "Yearly Basis Calc" (kolom K dan catatan Q).
  if (input.policyHolderAge < 18 || input.policyHolderAge > 55) {
    warnings.push("Usia masuk minimal 18 tahun dan maksimal 55 tahun.");
  }
  if (totalPremium < 36_000_000) warnings.push("Total premi minimal Rp36.000.000.");
  if (input.payMode === "Monthly" && input.premiumTerm === 1) {
    warnings.push("Bayar bulanan tidak tersedia untuk masa bayar 1 tahun (sekaligus).");
  }

  const rate = maturityRate(input);
  const years: MameYear[] = [];
  let accumulated = 0;

  for (let t = 1; t <= input.policyTerm; t++) {
    const premi = t <= input.premiumTerm ? annualPremium : 0;
    accumulated += premi;
    const terakhir = t === input.policyTerm;
    const faktor = terakhir ? null : cashValueFactor(input, t);

    years.push({
      policyYear: t,
      annualPremium: premi,
      accumulatedPremium: accumulated,
      maturityBenefit: terakhir && rate !== null ? rate * accumulated : 0,
      cashValue: terakhir ? null : faktor !== null ? faktor * accumulated : null,
      deathBenefit: 1.5 * accumulated,
      accidentalDeathBenefit: 3 * accumulated,
    });
  }

  return {
    annualPremium,
    monthlyPremium:
      input.payMode === "Monthly" && input.premiumTerm > 1 ? annualPremium / 12 : null,
    totalPremium,
    maturityRate: rate,
    years,
    warnings,
  };
}
