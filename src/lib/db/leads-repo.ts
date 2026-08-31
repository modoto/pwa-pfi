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
  "tenaga_pemasar", "rsm", "keterangan", "created_by", "updated_by",
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
    if (total > 0) return;

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

    await batch(statements);
  })();

  return bootstrapped;
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
