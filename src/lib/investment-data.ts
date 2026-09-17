/**
 * Pemetaan dana investasi dan penjelasan profil risiko.
 *
 * Daftar dananya dibaca dari tabel lokal `funds` (hasil GetAllFund, lihat
 * `listFunds` di src/lib/db/master-repo.ts). Yang tersisa di sini hanya
 * pemetaan ke mesin hitung MSL.xlsm, yang mengenal dana menurut urutan
 * kolomnya (`input!I5:I8`).
 */

/**
 * Kode dana di master → urutan dana di MSL.xlsm. Dipetakan lewat kode, bukan
 * nama, karena ejaannya berbeda: master menulis "Balance Fund" dan
 * "Fix Income Fund", workbook "Balanced Fund" dan "Fixed Income Fund".
 * Asumsi imbal hasil di master (−1/0/4·7·8·5%) per 2026-09-11 sama persis
 * dengan workbook.
 */
export const FUND_CODE_TO_WORKBOOK_INDEX: Record<string, number> = {
  MLLF: 0,
  MLBF: 1,
  MLEF: 2,
  MLFIF: 3,
};

/**
 * Nama dana versi lama, sebelum daftar dana dibaca dari master. Masih dipakai
 * untuk membaca alokasi yang terlanjur tersimpan tanpa kode dana.
 */
export const LEGACY_FUND_NAMES = [
  "PFI Mega Life Liquid Fund",
  "PFI Mega Life Balance Fund",
  "PFI Mega Life Equity Fund",
  "PFI Mega Life Fixed Income Fund",
] as const;

/*
 * Penjelasan tiap profil investasi kini dibaca dari master `mappings`
 * (kolom `definition_description`), bukan daftar tetap di sini.
 */
