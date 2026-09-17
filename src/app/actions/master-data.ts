"use server";

/**
 * Penarik master data dari API PFI.
 *
 * API tidak mengirim header CORS (docs/catatan-api.md), jadi pemanggilan harus
 * lewat server. Satu action = satu master supaya kemajuan bisa ditampilkan per
 * master dan satu endpoint yang rusak tidak menggagalkan sisanya.
 */

import { apiGet, syncChecksumRequest } from "@/lib/api";
import { MASTER_SOURCES } from "@/lib/master-data";
import { getSession } from "@/lib/session";

export type MasterFetchResult =
  | { ok: true; rows: Record<string, unknown>[] }
  | { ok: false; message: string };

type Row = Record<string, unknown>;

/** Sebagian endpoint membungkus daftarnya lagi, mis. `{ items: [...] }`. */
function rowsOf(data: unknown): Row[] | null {
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] })?.items)
      ? (data as { items: unknown[] }).items
      : null;

  if (!list) return null;
  return list.filter((row): row is Row => typeof row === "object" && row !== null);
}

async function fetchList(path: string, token: string): Promise<MasterFetchResult> {
  const result = await apiGet<unknown>(`/api/mobile/MasterData/${path}`, token);
  if (!result.ok) return { ok: false, message: result.message };

  const rows = rowsOf(result.data);
  if (!rows) return { ok: false, message: "Bentuk data tidak dikenali (bukan daftar)." };

  return { ok: true, rows };
}

/** Checksum tiap tabel di server: nama tabel → checksum. */
export async function fetchMasterChecksums(): Promise<
  { ok: true; checksums: Record<string, string> } | { ok: false; message: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Masuk ulang lalu coba lagi." };

  const hasil = await syncChecksumRequest(session.token);
  if (!hasil.ok) return { ok: false, message: hasil.message };

  return {
    ok: true,
    checksums: Object.fromEntries(hasil.data.map((row) => [row.tableName, String(row.checksum)])),
  };
}

/** Satu pertanyaan di dalam respons `GetDataRpqByRpqCode`. */
type RpqQuestion = {
  id?: number;
  rpqQuestionCode?: string;
  questionText?: string;
  status?: string;
};

/**
 * Pertanyaan RPQ hanya ada di `GetDataRpqByRpqCode?rpqCode=…`, yang membalas
 * satu objek konfigurasi berisi `questions` (masing-masing dengan `answers`).
 * Di sini pertanyaannya diratakan jadi baris tabel; bobot jawabannya sudah
 * ditarik terpisah lewat `GetAllRpqConfigAnswer`.
 */
async function fetchRpqQuestions(token: string): Promise<MasterFetchResult> {
  const konfigurasi = await fetchList("GetAllRpqConfig", token);
  if (!konfigurasi.ok) return konfigurasi;

  const rows: Row[] = [];

  for (const config of konfigurasi.rows) {
    const rpqCode = typeof config.rpqCode === "string" ? config.rpqCode : "";
    if (!rpqCode) continue;

    const hasil = await apiGet<unknown>(
      `/api/mobile/MasterData/GetDataRpqByRpqCode?rpqCode=${encodeURIComponent(rpqCode)}`,
      token
    );
    if (!hasil.ok) return { ok: false, message: `${rpqCode}: ${hasil.message}` };

    const questions = (hasil.data as { questions?: RpqQuestion[] } | null)?.questions;
    if (!Array.isArray(questions)) continue;

    questions.forEach((question, urutan) => {
      rows.push({
        id: question.id ?? null,
        rpqConfigId: config.id ?? null,
        rpqCode,
        rpqQuestionCode: question.rpqQuestionCode ?? null,
        questionText: question.questionText ?? null,
        sortOrder: urutan + 1,
        status: question.status ?? null,
      });
    });
  }

  return { ok: true, rows };
}

export async function fetchMasterData(endpoint: string): Promise<MasterFetchResult> {
  // Endpoint dicocokkan dengan daftar supaya nilai dari klien tidak bisa
  // dipakai memanggil jalur lain di API.
  const source = MASTER_SOURCES.find((item) => item.endpoint === endpoint);
  if (!source) return { ok: false, message: "Master data tidak dikenal." };

  const session = await getSession();
  if (!session) return { ok: false, message: "Sesi berakhir. Masuk ulang lalu coba lagi." };

  if (source.endpoint === "GetDataRpqByRpqCode") return fetchRpqQuestions(session.token);

  return fetchList(source.endpoint, session.token);
}
