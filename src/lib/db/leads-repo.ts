"use client";

/**
 * CRUD tabel `leads` di database lokal.
 *
 * Setiap perubahan menulis dua hal dalam satu transaksi: barisnya sendiri, dan
 * satu operasi di `sync_operations`. Pengirimnya belum ada — endpoint lead
 * belum tersedia di API — tapi antreannya sudah terisi sejak sekarang supaya
 * tidak ada perubahan yang hilang saat sinkronisasi dipasang nanti.
 */

import { batch, initDb, select } from "./client";
import type { Statement } from "./protocol";
import { getLeads as getSeedLeads } from "@/lib/leads-data";
import type { LeadStatus } from "@/lib/leads-data";

/** Satu baris tabel `leads`, apa adanya. */
export type LeadRow = {
  id: string;
  server_id: number | null;
  lead_code: string | null;
  nama_depan: string;
  nama_tengah: string | null;
  nama_belakang: string | null;
  jenis_kelamin: string | null;
  tanggal_lahir: string | null;
  nomor_telepon: string | null;
  alamat_email: string | null;
  cif: string | null;
  kode_cabang: string | null;
  kategori: string | null;
  sumber: string | null;
  bank_staff_nip: string | null;
  bank_staff_nama: string | null;
  status: LeadStatus;
  no_spaj: string | null;
  no_polis: string | null;
  tgl_inforce: string | null;
  skor_pekerjaan: number | null;
  skor_rumah: number | null;
  skor_sekolah: number | null;
  skor_anak: number | null;
  skor_kendaraan: number | null;
  skor_asuransi: number | null;
  skor_prediksi: number | null;
  skor_akhir: number | null;
  remark: string | null;
  tenaga_pemasar: string | null;
  rsm: string | null;
  keterangan: string | null;
  keterangan_status: string | null;
  created_by: string | null;
  updated_by: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  server_updated_at: string | null;
  deleted_at: string | null;
};

export type LeadAssignmentRow = {
  id: string;
  lead_id: string;
  tenaga_pemasar_sebelumnya: string | null;
  tenaga_pemasar_sekarang: string | null;
  rsm: string | null;
  tanggal: string | null;
  remark: string | null;
};

export type LeadInput = Partial<Omit<LeadRow, "id" | "created_at" | "updated_at">> & {
  nama_depan: string;
};

const uuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

/** Kolom yang boleh ditulis dari aplikasi (server_id dsb diisi proses sinkron). */
const WRITABLE = [
  "lead_code", "nama_depan", "nama_tengah", "nama_belakang", "jenis_kelamin",
  "tanggal_lahir", "nomor_telepon", "alamat_email", "cif", "kode_cabang",
  "kategori", "sumber", "bank_staff_nip", "bank_staff_nama", "status",
  "no_spaj", "no_polis", "tgl_inforce", "skor_pekerjaan", "skor_rumah",
  "skor_sekolah", "skor_anak", "skor_kendaraan", "skor_asuransi",
  "skor_prediksi", "skor_akhir", "remark",
  "tenaga_pemasar", "rsm", "keterangan", "keterangan_status",
  "created_by", "updated_by",
] as const;

/** Satu baris antrean sinkronisasi untuk operasi apa pun. */
function enqueue(
  operation: "insert" | "update" | "delete",
  recordId: string,
  payload: unknown
): Statement {
  return {
    sql: `insert into sync_operations
            (id, client_op_id, table_name, record_id, operation, payload, created_at)
          values (?, ?, 'leads', ?, ?, ?, ?)`,
    bind: [uuid(), uuid(), recordId, operation, JSON.stringify(payload), now()],
  };
}

/** Tabel lead beserta turunannya — dipakai saat menghapus seluruh data lead. */
const TABEL_LEAD = [
  "lead_illustration_fields",
  "lead_fna_answers",
  "lead_fna_priorities",
  "lead_processes",
  "lead_activities",
  "lead_assignments",
  "leads",
] as const;

/** Penanda kecil di `app_settings`, mis. apakah data contoh sudah disemai. */
async function bacaSetting(kunci: string): Promise<string | null> {
  const rows = await select<{ nilai: string | null }>(
    "select nilai from app_settings where kunci = ?",
    [kunci]
  );
  return rows[0]?.nilai ?? null;
}

const setSetting = (kunci: string, nilai: string): Statement => ({
  sql: `insert into app_settings (kunci, nilai) values (?, ?)
        on conflict(kunci) do update set nilai = excluded.nilai`,
  bind: [kunci, nilai],
});

/** Data contoh hanya disemai sekali; setelah dihapus tidak kembali lagi. */
const SUDAH_SEMAI = "leads_seeded";

let bootstrapped: Promise<void> | null = null;

/**
 * Siapkan database lalu isi data contoh bila tabel `leads` masih kosong.
 * Data contoh ini menggantikan array dummy yang dipakai sebelumnya; begitu API
 * lead tersedia, penyemaian ini yang pertama kali dihapus.
 */
export function ensureReady(): Promise<void> {
  bootstrapped ??= (async () => {
    await initDb();

    const [{ total }] = await select<{ total: number }>("select count(*) as total from leads");
    if (total > 0 || (await bacaSetting(SUDAH_SEMAI)) === "1") return;

    const timestamp = now();
    const statements: Statement[] = [];

    for (const lead of getSeedLeads()) {
      const id = uuid();

      statements.push({
        sql: `insert into leads
                (id, lead_code, nama_depan, jenis_kelamin, tanggal_lahir, nomor_telepon,
                 cif, kode_cabang, kategori, sumber, bank_staff_nip, bank_staff_nama,
                 status, no_spaj, no_polis, tgl_inforce,
                 skor_pekerjaan, skor_rumah, skor_sekolah, skor_anak, skor_kendaraan,
                 skor_asuransi, skor_prediksi, skor_akhir, remark,
                 tenaga_pemasar, rsm, created_by, updated_by,
                 sync_status, created_at, updated_at)
              values (?, ?, ?, 'Laki-Laki', '1990-10-02', ?, ?, 'KCP BLITAR', ?, ?,
                      'AG0001', 'Budi Santoso', ?, ?, ?, ?,
                      1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 2.3, 2.3,
                      'Antusias saat sesi event, minta dijadwalkan visit di rumah bersama istri.',
                      'Adi Wijaya', 'Hendra Wijaya', 'Adi Wijaya', 'Adi Wijaya',
                      'synced', ?, ?)`,
        bind: [
          id, lead.code, lead.name, lead.phone, `4000${lead.code.slice(-1)}`,
          lead.category, lead.source, lead.status, lead.spajNumber,
          lead.policyNumber, lead.inforceDate, timestamp, timestamp,
        ],
      });

      statements.push({
        sql: `insert into lead_assignments
                (id, lead_id, tenaga_pemasar_sebelumnya, tenaga_pemasar_sekarang,
                 rsm, tanggal, remark, created_at, updated_at)
              values (?, ?, null, 'Adi Wijaya', 'Hendra Wijaya', '01/06/2026',
                      'Assignment awal (peserta event Nutrition Talk)', ?, ?)`,
        bind: [uuid(), id, timestamp, timestamp],
      });
    }

    statements.push(setSetting(SUDAH_SEMAI, "1"));
    await batch(statements);
  })();

  return bootstrapped;
}

/**
 * Hapus seluruh data lead di perangkat: tabel `leads`, tabel turunannya, dan
 * antrean `sync_operations`. Dipakai dari halaman Profil, mis. sebelum
 * menarik ulang data lead dari API.
 *
 * Data contoh tidak disemai lagi setelah ini (penanda `leads_seeded`), supaya
 * daftar lead tidak kembali berisi data bohongan begitu halaman dibuka.
 */
export async function wipeLeads(): Promise<{ tabel: string; dihapus: number }[]> {
  await initDb();

  const hasil: { tabel: string; dihapus: number }[] = [];
  const statements: Statement[] = [];

  for (const tabel of [...TABEL_LEAD, "sync_operations"]) {
    const [{ total }] = await select<{ total: number }>(`select count(*) as total from ${tabel}`);
    hasil.push({ tabel, dihapus: total });
    statements.push({ sql: `delete from ${tabel}` });
  }

  statements.push(setSetting(SUDAH_SEMAI, "1"));
  await batch(statements);

  // Penyemaian hanya berjalan sekali per muat halaman; penandanya dilepas agar
  // pemeriksaan berikutnya membaca app_settings lagi.
  bootstrapped = null;

  return hasil;
}

/** Satu lead dari `GetAllLeads` — hanya field yang dipetakan ke tabel lokal. */
export type ApiLead = {
  id: number;
  leadCode: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  gender: number | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  email: string | null;
  cifNumber: string | null;
  branchName: string | null;
  leadCategory: string | null;
  leadSource: string | null;
  leadStatus: string | null;
  spajNumber: string | null;
  policyNumber: string | null;
  inforcedDate: string | null;
  agentNip: string | null;
  hdamNip: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastUpdatedAt: string | null;
  deletedAt: string | null;
};

/** Satu baris `GetAllLeadScore`; satu lead bisa punya beberapa (per `sequence`). */
export type ApiLeadScore = {
  leadId: number;
  sequence: number | null;
  jobScore: number | null;
  houseScore: number | null;
  schoolScore: number | null;
  childScore: number | null;
  vehicleScore: number | null;
  insuranceScore: number | null;
  predictionScore: number | null;
  finalScore: number | null;
  remarkScore: string | null;
};

export type ImportLeadsResult = {
  baru: number;
  diperbarui: number;
  /** Lead yang punya perubahan lokal belum tersinkron — sengaja tidak ditimpa. */
  dilewati: number;
};

/** API mengirim jenis kelamin sebagai angka; 0 = laki-laki, 1 = perempuan. */
const jenisKelamin = (gender: number | null) =>
  gender === 0 ? "Laki-Laki" : gender === 1 ? "Perempuan" : null;

/** "1990-10-02T00:00:00" → "1990-10-02"; kosong tetap null. */
const tanggalSaja = (nilai: string | null) => (nilai ? nilai.slice(0, 10) : null);

/**
 * Masukkan lead dari API ke database lokal, dicocokkan lewat `server_id`.
 *
 * Lead yang masih `pending` (ada perubahan lokal yang belum terkirim) tidak
 * ditimpa: API belum punya endpoint tulis, jadi perubahan itu satu-satunya
 * salinan yang ada. Lead lokal yang tidak ada di server dibiarkan.
 */
export async function importLeads(
  leads: ApiLead[],
  scores: ApiLeadScore[] = []
): Promise<ImportLeadsResult> {
  await initDb();

  // Satu lead bisa punya beberapa baris skor; yang dipakai urutan terakhir.
  const skorTerbaru = new Map<number, ApiLeadScore>();
  for (const skor of scores) {
    const ada = skorTerbaru.get(skor.leadId);
    if (!ada || (skor.sequence ?? 0) >= (ada.sequence ?? 0)) skorTerbaru.set(skor.leadId, skor);
  }

  const lokal = await select<{ id: string; server_id: number | null; sync_status: string }>(
    "select id, server_id, sync_status from leads where server_id is not null"
  );
  const perServerId = new Map(lokal.map((row) => [Number(row.server_id), row]));

  const timestamp = now();
  const statements: Statement[] = [];
  const hasil: ImportLeadsResult = { baru: 0, diperbarui: 0, dilewati: 0 };

  for (const lead of leads) {
    const ada = perServerId.get(lead.id);
    if (ada && ada.sync_status === "pending") {
      hasil.dilewati += 1;
      continue;
    }

    const skor = skorTerbaru.get(lead.id);
    const nilai: Record<string, string | number | null> = {
      lead_code: lead.leadCode ?? null,
      nama_depan: lead.firstName ?? "(tanpa nama)",
      nama_tengah: lead.middleName ?? null,
      nama_belakang: lead.lastName ?? null,
      jenis_kelamin: jenisKelamin(lead.gender ?? null),
      tanggal_lahir: tanggalSaja(lead.dateOfBirth ?? null),
      nomor_telepon: lead.phoneNumber ?? null,
      alamat_email: lead.email ?? null,
      cif: lead.cifNumber ?? null,
      kode_cabang: lead.branchName ?? null,
      kategori: lead.leadCategory ?? null,
      sumber: lead.leadSource ?? null,
      status: lead.leadStatus ?? "New",
      no_spaj: lead.spajNumber ?? null,
      no_polis: lead.policyNumber ?? null,
      tgl_inforce: tanggalSaja(lead.inforcedDate ?? null),
      skor_pekerjaan: skor?.jobScore ?? null,
      skor_rumah: skor?.houseScore ?? null,
      skor_sekolah: skor?.schoolScore ?? null,
      skor_anak: skor?.childScore ?? null,
      skor_kendaraan: skor?.vehicleScore ?? null,
      skor_asuransi: skor?.insuranceScore ?? null,
      skor_prediksi: skor?.predictionScore ?? null,
      skor_akhir: skor?.finalScore ?? null,
      remark: skor?.remarkScore ?? null,
      // NIP agen dan HDAM dipakai apa adanya; nama lengkapnya tidak ikut dikirim.
      tenaga_pemasar: lead.agentNip ?? null,
      rsm: lead.hdamNip ?? null,
      sync_status: "synced",
      server_updated_at: lead.lastUpdatedAt ?? lead.updatedAt ?? null,
      deleted_at: lead.deletedAt ?? null,
    };
    const kolom = Object.keys(nilai);

    if (ada) {
      statements.push({
        sql: `update leads set ${kolom.map((k) => `${k} = ?`).join(", ")}, updated_at = ?
              where id = ?`,
        bind: [...Object.values(nilai), lead.updatedAt ?? timestamp, ada.id],
      });
      hasil.diperbarui += 1;
    } else {
      statements.push({
        sql: `insert into leads (id, server_id, ${kolom.join(", ")}, created_at, updated_at)
              values (?, ?, ${kolom.map(() => "?").join(", ")}, ?, ?)`,
        bind: [
          uuid(),
          lead.id,
          ...Object.values(nilai),
          lead.createdAt ?? timestamp,
          lead.updatedAt ?? timestamp,
        ],
      });
      hasil.baru += 1;
    }
  }

  // Data dari server bukan data contoh; penyemaian tidak perlu jalan lagi.
  statements.push(setSetting(SUDAH_SEMAI, "1"));
  await batch(statements);

  return hasil;
}

export async function listLeads(): Promise<LeadRow[]> {
  await ensureReady();
  return select<LeadRow>(
    "select * from leads where deleted_at is null order by created_at asc, lead_code asc"
  );
}

export async function getLead(id: string): Promise<LeadRow | null> {
  await ensureReady();
  const rows = await select<LeadRow>("select * from leads where id = ? and deleted_at is null", [id]);
  return rows[0] ?? null;
}

export async function createLead(input: LeadInput): Promise<string> {
  await ensureReady();

  const id = uuid();
  const timestamp = now();
  const columns = WRITABLE.filter((column) => input[column] !== undefined);

  const record = Object.fromEntries(columns.map((column) => [column, input[column] ?? null]));

  await batch([
    {
      sql: `insert into leads (id, ${columns.join(", ")}, sync_status, created_at, updated_at)
            values (?, ${columns.map(() => "?").join(", ")}, 'pending', ?, ?)`,
      bind: [id, ...columns.map((column) => (input[column] ?? null) as never), timestamp, timestamp],
    },
    enqueue("insert", id, { id, ...record }),
  ]);

  return id;
}

export async function updateLead(id: string, input: Partial<LeadInput>): Promise<void> {
  await ensureReady();

  const columns = WRITABLE.filter((column) => input[column] !== undefined);
  if (columns.length === 0) return;

  const timestamp = now();
  const record = Object.fromEntries(columns.map((column) => [column, input[column] ?? null]));

  await batch([
    {
      sql: `update leads
            set ${columns.map((column) => `${column} = ?`).join(", ")},
                sync_status = 'pending', updated_at = ?
            where id = ?`,
      bind: [...columns.map((column) => (input[column] ?? null) as never), timestamp, id],
    },
    enqueue("update", id, { id, ...record }),
  ]);
}

/**
 * Hapus lunak. Baris tetap disimpan sampai server mengonfirmasi — hapus
 * permanen saat offline membuat server tidak pernah tahu penghapusannya.
 */
export async function deleteLead(id: string): Promise<void> {
  await ensureReady();

  const timestamp = now();
  await batch([
    {
      sql: "update leads set deleted_at = ?, sync_status = 'pending', updated_at = ? where id = ?",
      bind: [timestamp, timestamp, id],
    },
    enqueue("delete", id, { id }),
  ]);
}

/** Duplikat satu lead sebagai record baru yang belum tersinkron. */
export async function duplicateLead(id: string): Promise<string | null> {
  const source = await getLead(id);
  if (!source) return null;

  const copy = Object.fromEntries(
    WRITABLE.map((column) => [column, source[column]])
  ) as unknown as LeadInput;

  return createLead({ ...copy, lead_code: null, no_spaj: null, no_polis: null, tgl_inforce: null });
}

export async function listAssignments(leadId: string): Promise<LeadAssignmentRow[]> {
  await ensureReady();
  return select<LeadAssignmentRow>(
    `select id, lead_id, tenaga_pemasar_sebelumnya, tenaga_pemasar_sekarang,
            rsm, tanggal, remark
     from lead_assignments
     where lead_id = ? and deleted_at is null
     order by created_at asc`,
    [leadId]
  );
}

export type PendingOperation = {
  id: string;
  client_op_id: string;
  table_name: string;
  record_id: string;
  operation: string;
  created_at: string;
  attempts: number;
};

/** Antrean yang menunggu dikirim — dipakai indikator dan, nanti, pengirimnya. */
export async function pendingOperations(): Promise<PendingOperation[]> {
  await ensureReady();
  return select<PendingOperation>(
    "select id, client_op_id, table_name, record_id, operation, created_at, attempts from sync_operations order by created_at asc"
  );
}
