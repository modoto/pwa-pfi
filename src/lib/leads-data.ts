/**
 * Data contoh Daftar Leads.
 *
 * Swagger API belum punya endpoint lead sama sekali, jadi seluruh isi halaman
 * masih dari sini. Bentuk tipenya disiapkan agar mudah ditukar nanti.
 */

/**
 * Status lead. Urutannya mengikuti master `GetAllStatus`
 * (`groupStatus: "lead_status"`, 16 status per 2026-09-16); "On Progress"
 * ditambahkan karena itu ejaan di desain Figma sedangkan API menulis
 * "In Progress" — keduanya bisa muncul di data lokal.
 */
export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "In Progress",
  "On Progress",
  "Illustration",
  "Submitted",
  "Application",
  "Pending Quote",
  "Pending Proposal",
  "Pending for Payment",
  "Waiting for UW Approval",
  "Declined",
  "Postpone",
  "Issued",
  "Drop",
  "Drop Manual",
  "Drop Auto",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

/**
 * Pilihan pada modal Ubah Status Lead, persis dua opsi di desain.
 *
 * Bukan seluruh `LEAD_STATUSES`: status lain berpindah sendiri mengikuti proses
 * (ilustrasi, pengajuan, pembayaran), bukan dipilih manual oleh agen. Aturan
 * transisi yang sebenarnya masih menunggu konfirmasi bisnis.
 */
export const LEAD_STATUS_CHOICES = ["Contacted", "Drop Manual"] as const;

export const LEAD_CATEGORIES = ["Referral", "Natural Market"] as const;
export type LeadCategory = (typeof LEAD_CATEGORIES)[number];

export type Lead = {
  id: string;
  code: string;
  name: string;
  phone: string;
  category: LeadCategory;
  source: string;
  status: LeadStatus;
  spajNumber: string | null;
  policyNumber: string | null;
  inforceDate: string | null;
};

export type StatusTone = "blue" | "purple" | "orange" | "green" | "red";

/**
 * Kelompok warna chip status: empat varian desain, plus merah untuk drop.
 * Kuncinya sengaja `string` — status bisa datang dari API dengan nama yang
 * belum dikenal, dan pemakainya memakai "blue" sebagai cadangan.
 */
export const STATUS_TONE: Record<string, StatusTone> = {
  New: "blue",
  Contacted: "blue",
  "In Progress": "blue",
  "On Progress": "blue",
  Illustration: "purple",
  Application: "purple",
  Submitted: "purple",
  "Pending Quote": "orange",
  "Pending Proposal": "orange",
  "Pending for Payment": "orange",
  "Waiting for UW Approval": "orange",
  Postpone: "orange",
  Issued: "green",
  Declined: "red",
  Drop: "red",
  "Drop Manual": "red",
  "Drop Auto": "red",
};

/** Sepuluh baris pertama persis seperti pada desain Figma. */
const SEED: Omit<Lead, "id">[] = [
  { code: "LD0001", name: "Budi Cahyadi", phone: "081234567890", category: "Referral", source: "Bank Staff", status: "On Progress", spajNumber: null, policyNumber: null, inforceDate: null },
  { code: "LD0002", name: "Sari Oktaviani", phone: "081234567891", category: "Referral", source: "Bank Staff", status: "Contacted", spajNumber: null, policyNumber: null, inforceDate: null },
  { code: "LD0003", name: "Andi Wijaya", phone: "081234567892", category: "Referral", source: "Bank Staff", status: "New", spajNumber: null, policyNumber: null, inforceDate: null },
  { code: "LD0004", name: "Rina Marlina", phone: "081234567893", category: "Referral", source: "Bank Staff", status: "Illustration", spajNumber: null, policyNumber: null, inforceDate: null },
  { code: "LD0005", name: "Dedi Gunawan", phone: "081234567894", category: "Referral", source: "Bank Staff", status: "Application", spajNumber: "202600441", policyNumber: null, inforceDate: null },
  { code: "LD0006", name: "Maya Putri Lestari", phone: "081234567895", category: "Referral", source: "Bank Staff", status: "Submitted", spajNumber: "202600442", policyNumber: null, inforceDate: null },
  { code: "LD0007", name: "Joko Prabowo", phone: "081234567896", category: "Natural Market", source: "Natural Market", status: "Pending Quote", spajNumber: "202600443", policyNumber: null, inforceDate: null },
  { code: "LD0008", name: "Nia Ramadhani", phone: "081234567897", category: "Natural Market", source: "Natural Market", status: "Pending Proposal", spajNumber: "202600444", policyNumber: null, inforceDate: null },
  { code: "LD0009", name: "Tommy Herlambang", phone: "081234567898", category: "Natural Market", source: "Natural Market", status: "Pending for Payment", spajNumber: "202600445", policyNumber: null, inforceDate: null },
  { code: "LD0010", name: "Fitriani Azzahra", phone: "081234567899", category: "Natural Market", source: "Natural Market", status: "Issued", spajNumber: "202600446", policyNumber: "20260009", inforceDate: "18/07/2026" },
];

const EXTRA_NAMES = [
  "Agus Setiawan", "Bella Kurnia", "Chandra Wijaya", "Dewi Anggraini", "Erik Nugroho",
  "Farah Salsabila", "Gilang Ramadhan", "Hana Puspita", "Irfan Maulana", "Jihan Aprilia",
];

/**
 * Desain menampilkan "Showing 10 of 60 data", jadi 50 baris tambahan dibuat
 * dari pola yang sama supaya paginasinya benar-benar bisa dicoba.
 */
function buildLeads(): Lead[] {
  const leads: Lead[] = SEED.map((lead, i) => ({ id: `L${i + 1}`, ...lead }));

  for (let i = 10; i < 60; i += 1) {
    const seed = SEED[i % SEED.length];
    const number = String(i + 1).padStart(4, "0");

    leads.push({
      ...seed,
      id: `L${i + 1}`,
      code: `LD${number}`,
      name: EXTRA_NAMES[i % EXTRA_NAMES.length],
      phone: `08123456${String(7890 + i).slice(-4)}`,
      spajNumber: seed.spajNumber ? String(202600441 + i) : null,
      policyNumber: seed.policyNumber ? String(20260009 + i) : null,
    });
  }

  return leads;
}

export function getLeads(): Lead[] {
  return buildLeads();
}

export const PAGE_SIZE = 10;
