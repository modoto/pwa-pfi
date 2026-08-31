/**
 * Data contoh Daftar Leads.
 *
 * Swagger API belum punya endpoint lead sama sekali, jadi seluruh isi halaman
 * masih dari sini. Bentuk tipenya disiapkan agar mudah ditukar nanti.
 */

export const LEAD_STATUSES = [
  "New",
  "Contacted",
  "On Progress",
  "Illustration",
  "Application",
  "Submitted",
  "Pending Quote",
  "Pending Proposal",
  "Pending for Payment",
  "Issued",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

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

/** Kelompok warna chip status, mengikuti empat varian di desain. */
export const STATUS_TONE: Record<LeadStatus, "blue" | "purple" | "orange" | "green"> = {
  New: "blue",
  Contacted: "blue",
  "On Progress": "blue",
  Illustration: "purple",
  Application: "purple",
  Submitted: "purple",
  "Pending Quote": "orange",
  "Pending Proposal": "orange",
  "Pending for Payment": "orange",
  Issued: "green",
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
