"use client";

/**
 * CRUD tabel `lead_activities`.
 *
 * Pola sama seperti `leads-repo.ts`: setiap perubahan menulis barisnya sendiri
 * dan satu operasi `sync_operations` dalam satu transaksi.
 */

import { batch, select } from "./client";
import type { Statement } from "./protocol";
import { ensureReady } from "./leads-repo";

export const JENIS_AKTIVITAS = [
  "Visit Offline",
  "Visit Online",
  "Telepon",
  "Training Online",
  "Follow Up",
] as const;

export const CATATAN_AKTIVITAS = ["Visit 1", "Visit 2", "Visit 3", "Visit Lebih Dari 3"] as const;

export const ACTIVITY_STATUSES = ["Terjadwal", "Perlu Update", "Selesai"] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export type ActivityRow = {
  id: string;
  server_id: number | null;
  lead_id: string;
  jenis_aktivitas: string;
  keterangan: string | null;
  tanggal: string | null;
  waktu: string | null;
  lokasi_rencana: string | null;
  lokasi_aktual: string | null;
  catatan: string | null;
  catatan_tambahan: string | null;
  gambar: Uint8Array | null;
  gambar_tipe: string | null;
  gambar_nama: string | null;
  status: ActivityStatus;
  created_by: string | null;
  updated_by: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type ActivityInput = {
  jenis_aktivitas: string;
  keterangan?: string | null;
  tanggal?: string | null;
  waktu?: string | null;
  lokasi_rencana?: string | null;
  lokasi_aktual?: string | null;
  catatan?: string | null;
  catatan_tambahan?: string | null;
  gambar?: Uint8Array | null;
  gambar_tipe?: string | null;
  gambar_nama?: string | null;
  status?: ActivityStatus;
  created_by?: string | null;
  updated_by?: string | null;
};

const WRITABLE = [
  "jenis_aktivitas", "keterangan", "tanggal", "waktu", "lokasi_rencana",
  "lokasi_aktual", "catatan", "catatan_tambahan", "gambar", "gambar_tipe",
  "gambar_nama", "status", "created_by", "updated_by",
] as const;

const uuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

function enqueue(
  operation: "insert" | "update" | "delete",
  recordId: string,
  payload: unknown
): Statement {
  return {
    sql: `insert into sync_operations
            (id, client_op_id, table_name, record_id, operation, payload, created_at)
          values (?, ?, 'lead_activities', ?, ?, ?, ?)`,
    bind: [uuid(), uuid(), recordId, operation, JSON.stringify(payload), now()],
  };
}

/** Gambar tidak ikut payload antrean — biner dikirim terpisah saat sinkron. */
function payloadOf(input: Partial<ActivityInput>) {
  const { gambar, ...rest } = input;
  return { ...rest, gambar: gambar ? `<${gambar.byteLength} bytes>` : null };
}

export async function listActivities(leadId: string): Promise<ActivityRow[]> {
  await ensureReady();
  return select<ActivityRow>(
    `select * from lead_activities
     where lead_id = ? and deleted_at is null
     order by tanggal desc, created_at desc`,
    [leadId]
  );
}

export async function createActivity(leadId: string, input: ActivityInput): Promise<string> {
  await ensureReady();

  const id = uuid();
  const timestamp = now();
  const columns = WRITABLE.filter((column) => input[column] !== undefined);

  await batch([
    {
      sql: `insert into lead_activities
              (id, lead_id, ${columns.join(", ")}, sync_status, created_at, updated_at)
            values (?, ?, ${columns.map(() => "?").join(", ")}, 'pending', ?, ?)`,
      bind: [
        id,
        leadId,
        ...columns.map((column) => (input[column] ?? null) as never),
        timestamp,
        timestamp,
      ],
    },
    enqueue("insert", id, { id, lead_id: leadId, ...payloadOf(input) }),
  ]);

  return id;
}

export async function updateActivity(id: string, input: Partial<ActivityInput>): Promise<void> {
  await ensureReady();

  const columns = WRITABLE.filter((column) => input[column] !== undefined);
  if (columns.length === 0) return;

  const timestamp = now();

  await batch([
    {
      sql: `update lead_activities
            set ${columns.map((column) => `${column} = ?`).join(", ")},
                sync_status = 'pending', updated_at = ?
            where id = ?`,
      bind: [...columns.map((column) => (input[column] ?? null) as never), timestamp, id],
    },
    enqueue("update", id, { id, ...payloadOf(input) }),
  ]);
}

export async function deleteActivity(id: string): Promise<void> {
  await ensureReady();

  const timestamp = now();
  await batch([
    {
      sql: `update lead_activities
            set deleted_at = ?, sync_status = 'pending', updated_at = ?
            where id = ?`,
      bind: [timestamp, timestamp, id],
    },
    enqueue("delete", id, { id }),
  ]);
}
