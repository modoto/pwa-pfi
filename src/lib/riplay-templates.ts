/**
 * Template RIPLAY Personal per produk (berkasnya di public/riplay/).
 *
 * Master `illustration_templates` hanya menyimpan nama template, bukan
 * berkasnya, jadi template dicocokkan lewat nama lengkap produk — kolom
 * `description` di master `products` (mis. "Mega Asuransi Maksima Link"),
 * yang sama persis dengan isian "Nama Produk" di dokumennya.
 *
 * Satu produk bisa punya lebih dari satu template. MAME punya dua menurut
 * metode seleksi risiko (Full Underwriting / Simplified Issuance Offering) —
 * data yang tidak ada di master, jadi agen memilihnya di langkah RIPLAY.
 *
 * Per 2026-09-16 master menambah MAML VIP (kode 221) dan MAML VVIP (222), yang
 * `description`-nya sama dengan MAML Regular sehingga ketiganya memakai
 * `replay_personal_maml.docx`. Master sendiri mencatat template terpisah
 * (ILT0004 "MAML VIP Riplay", ILT0005 "MAML VVIP Riplay") — berkasnya belum
 * ada di public/riplay, perlu diminta ke tim bisnis. Produk baru lain: MAMS
 * (memakai `replay_personal_mams.docx`) dan MSP "Mega Saving Protection"
 * (`replay_personal_msp.docx`, ditambahkan user 2026-09-17).
 */

export type RiplayTemplateId =
  | "maml"
  | "mame_fuw"
  | "mame_sio"
  | "makna"
  | "mams"
  | "mapan"
  | "mega_warisan"
  | "mpol"
  | "msl"
  | "msp";

export type RiplayTemplate = {
  id: RiplayTemplateId;
  file: string;
  /** Nama lengkap produk, dibandingkan dengan `products.description`. */
  produk: string;
  /** Pembeda bila satu produk punya beberapa template. */
  varian?: string;
};

export const RIPLAY_TEMPLATES: RiplayTemplate[] = [
  { id: "maml", file: "replay_personal_maml.docx", produk: "Mega Asuransi Maksima Link" },
  {
    id: "mame_fuw",
    file: "replay_personal_mame_fuw.docx",
    produk: "Mega Asuransi Maksima Edukasi",
    varian: "Full Underwriting",
  },
  {
    id: "mame_sio",
    file: "replay_personal_mame_sio.docx",
    produk: "Mega Asuransi Maksima Edukasi",
    varian: "Simplified Issuance Offering",
  },
  { id: "makna", file: "replay_personal_makna.docx", produk: "Mega Asuransi Kesejahteraan Andalan" },
  { id: "mams", file: "replay_personal_mams.docx", produk: "Mega Asuransi Maksima Solusi" },
  { id: "mapan", file: "replay_personal_mapan.docx", produk: "Mega Proteksi Masa Depan" },
  { id: "mega_warisan", file: "replay_personal_mega_warisan.docx", produk: "Mega Warisan" },
  { id: "mpol", file: "replay_personal_mpol.docx", produk: "Mega Proteksi Optima Link" },
  { id: "msp", file: "replay_personal_msp.docx", produk: "Mega Saving Protection" },
  // Template pertama dari tim bisnis (disalin dari src/replay/ oleh
  // scripts/copy-riplay.mjs); produknya belum ada di master.
  { id: "msl", file: "riplay_personal_msl.docx", produk: "Mega Signature Link" },
];

const sama = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Template untuk satu produk; kosong bila belum ada template-nya. */
export function templatesForProduct(namaLengkap: string | null | undefined): RiplayTemplate[] {
  if (!namaLengkap) return [];
  return RIPLAY_TEMPLATES.filter((template) => sama(template.produk, namaLengkap));
}

export const templateUrl = (template: RiplayTemplate) => `/riplay/${template.file}`;
