import type { MslRiderKey } from "@/lib/calc/msl-engine";

/**
 * Rider di langkah ketiga Sales Illustration berasal dari master `riders`
 * (lewat `ps_riders`). Tiap rider disimpan di `lead_illustration_fields`
 * dengan awalan `riderKey(rider_code)`:
 *
 * - `<key>_dipilih` = "Ya"
 * - `<key>_nama`    = nama rider saat dipilih (dibaca Kutipan & RIPLAY)
 * - `<key>_kode`    = singkatan rider (`description` di master, mis. "CIP")
 * - `<key>_up`, `<key>_masa`
 *
 * Nama dan kode ikut disimpan supaya kalkulator dan RIPLAY cukup membaca isian
 * langkah ini, tanpa membuka tabel master lagi.
 */
export const riderKey = (riderCode: string) => `rider_${riderCode}`;

/**
 * Singkatan rider di master → komponen tarif di MSL.xlsm. Singkatan tanpa
 * padanan (Mega 45 CI "C145", Mega CIWP "CIWP") belum punya tabel tarif di
 * workbook, jadi tidak ikut dihitung.
 */
export const RIDER_CODE_TO_ENGINE: Record<string, MslRiderKey> = {
  CIP: "ciPlus",
  HCP: "hcp",
  "MEGA HCP": "hcp",
  HCPP: "hcpPlus",
  PAA: "paa",
  PAB: "paab",
  WP: "wp",
  PP: "parentPayor",
  SP: "spousePayor",
};

export const riderEngineKey = (kode: string | null | undefined): MslRiderKey | null =>
  RIDER_CODE_TO_ENGINE[(kode ?? "").trim().toUpperCase()] ?? null;

/**
 * Rider yang biayanya dihitung dari premi, bukan dari uang pertanggungan —
 * kolom Uang Pertanggungan-nya tidak diisi.
 */
export const RIDER_TANPA_UP: ReadonlySet<MslRiderKey> = new Set([
  "wp",
  "spousePayor",
  "parentPayor",
]);

export type RiderTerpilih = {
  key: string;
  nama: string;
  kode: string;
  up: string;
  masa: string;
  mesin: MslRiderKey | null;
};

/**
 * Rider yang dicentang pada isian langkah Rider. Isian lama dari daftar rider
 * sementara (sebelum memakai master) tidak punya `_nama`, jadi diabaikan.
 */
export function ridersTerpilih(rider: Record<string, string>): RiderTerpilih[] {
  return Object.keys(rider)
    .filter((field) => field.endsWith("_dipilih") && rider[field] === "Ya")
    .map((field) => field.slice(0, -"_dipilih".length))
    .filter((key) => Boolean(rider[`${key}_nama`]))
    .sort()
    .map((key) => ({
      key,
      nama: rider[`${key}_nama`] ?? "",
      kode: rider[`${key}_kode`] ?? "",
      up: rider[`${key}_up`] ?? "",
      masa: rider[`${key}_masa`] ?? "",
      mesin: riderEngineKey(rider[`${key}_kode`]),
    }));
}
