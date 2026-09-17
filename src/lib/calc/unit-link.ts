/**
 * Pemilih mesin proyeksi unit link per produk.
 *
 * - Mega Asuransi Maksima Link (MAML) → maml-engine.ts (MAML.xlsm)
 * - Mega Signature Link (MSL)        → msl-engine.ts  (MSL.xlsm)
 *
 * Keduanya menerima `MslInput` dan menghasilkan `MslProjection` yang sama
 * bentuknya, jadi layar Kutipan, Rider, dan RIPLAY tidak perlu tahu mesinnya.
 */

import { projectMaml } from "./maml-engine";
import {
  firstYearRiderCosts as mslFirstYearRiderCosts,
  projectMsl,
  type MslInput,
  type MslProjection,
  type MslRiderKey,
} from "./msl-engine";

export type UnitLinkProduct = "maml" | "msl";

/**
 * Produk dari nama yang tersimpan di langkah Rincian Produk
 * (mis. "Mega Asuransi Maksima Link (MAML Regular)"). Selain MAML dianggap MSL,
 * satu-satunya kalkulator unit link lain yang sudah di-port.
 *
 * Catatan: MAML VIP dan VVIP (master per 2026-09-16) ikut memakai mesin MAML
 * karena namanya sama; belum dipastikan apakah asumsi kedua varian itu sama
 * dengan MAML Regular di MAML.xlsm.
 */
export function unitLinkProductOf(namaProduk: string | undefined): UnitLinkProduct {
  return /maksima link|\bmaml\b/i.test(namaProduk ?? "") ? "maml" : "msl";
}

/**
 * Di MAML.xlsm masa asuransi bukan isian: selalu sampai usia 100
 * (`Coverage = CoverageAge - Insured_Age`), jadi pilihan masa pertanggungan
 * di formulir tidak memotong proyeksi MAML.
 */
export function projectUnitLink(product: UnitLinkProduct, input: MslInput): MslProjection {
  return product === "maml"
    ? projectMaml({ ...input, coverageYears: undefined })
    : projectMsl(input);
}

/** Biaya tiap rider pada tahun polis pertama, untuk kolom Premi di langkah Rider. */
export function firstYearRiderCostsFor(
  product: UnitLinkProduct,
  input: MslInput
): Partial<Record<MslRiderKey, number>> {
  if (product === "msl") return mslFirstYearRiderCosts(input);
  return projectMaml({ ...input, coverageYears: 1 }).years[0]?.riderCosts ?? {};
}
