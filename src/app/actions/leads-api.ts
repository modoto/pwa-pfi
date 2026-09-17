"use server";

/**
 * Penarik data lead dari API ke perangkat.
 *
 * Endpoint lead baru muncul pada 2026-09-16 dan **hanya GET**
 * (`GetAllLeads`, `GetAllLeadScore`), jadi arahnya masih satu jalur:
 * server → lokal. Pengiriman perubahan dari perangkat menunggu endpoint tulis;
 * lihat docs/offline-first-sync.md.
 *
 * API tidak mengirim header CORS, jadi pemanggilannya harus lewat server Next
 * seperti master data lainnya.
 */

import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/session";
import type { ApiLead, ApiLeadScore } from "@/lib/db/leads-repo";

export type LeadsFetchResult =
  | { ok: true; leads: ApiLead[]; scores: ApiLeadScore[] }
  | { ok: false; message: string };

function rowsOf<T>(data: unknown): T[] | null {
  if (!Array.isArray(data)) return null;
  return data.filter((row): row is T => typeof row === "object" && row !== null);
}

export async function fetchLeadsFromApi(): Promise<LeadsFetchResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Masuk ulang lalu coba lagi." };

  const leads = await apiGet<unknown>("/api/mobile/MasterData/GetAllLeads", session.token);
  if (!leads.ok) return { ok: false, message: `GetAllLeads: ${leads.message}` };

  const baris = rowsOf<ApiLead>(leads.data);
  if (!baris) return { ok: false, message: "Bentuk data lead tidak dikenali (bukan daftar)." };

  // Skor dipisah di endpointnya sendiri; kegagalannya tidak membatalkan
  // penarikan lead, cukup membuat kolom skor kosong.
  const scores = await apiGet<unknown>("/api/mobile/MasterData/GetAllLeadScore", session.token);

  return {
    ok: true,
    leads: baris,
    scores: scores.ok ? (rowsOf<ApiLeadScore>(scores.data) ?? []) : [],
  };
}
