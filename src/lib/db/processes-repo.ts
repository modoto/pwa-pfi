"use client";

/**
 * Tabel `lead_processes` — tiga proses pada modal Mulai Proses.
 *
 * Halaman ketiga proses belum ada, jadi repo ini baru menyediakan pembacaan.
 * Fungsi untuk memulai/menyelesaikan proses ditambahkan saat halamannya dibuat,
 * dengan pola sama seperti repo lain: satu baris data + satu baris
 * `sync_operations` dalam satu transaksi.
 */

import { batch, select } from "./client";
import type { Statement } from "./protocol";
import { ensureReady } from "./leads-repo";

export const PROCESS_KINDS = ["analisis", "ilustrasi", "eapp"] as const;
export type ProcessKind = (typeof PROCESS_KINDS)[number];

export const PROCESS_STATUSES = [
  "Belum dibuka",
  "Belum dimulai",
  "Sedang berjalan",
  "Selesai",
] as const;
export type ProcessStatus = (typeof PROCESS_STATUSES)[number];

/** Status awal tiap proses, mengikuti desain: E-App terkunci sampai dibuka. */
const DEFAULT_STATUS: Record<ProcessKind, ProcessStatus> = {
  analisis: "Belum dimulai",
  ilustrasi: "Belum dimulai",
  eapp: "Belum dibuka",
};

export type ProcessRow = {
  id: string;
  server_id: number | null;
  lead_id: string;
  jenis: ProcessKind;
  status: ProcessStatus;
  dimulai_at: string | null;
  selesai_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  server_updated_at: string | null;
  deleted_at: string | null;
};

const uuid = () =>
  typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const now = () => new Date().toISOString();

/**
 * Lengkapi baris proses yang belum ada untuk satu lead.
 *
 * Tidak masuk antrean `sync_operations`: ini nilai awal buatan klien, bukan
 * perubahan yang dibuat agen. Begitu endpoint proses tersedia, baris inilah
 * yang ditimpa data server.
 */
async function ensureProcesses(leadId: string): Promise<void> {
  const rows = await select<{ jenis: ProcessKind }>(
    "select jenis from lead_processes where lead_id = ?",
    [leadId]
  );

  const missing = PROCESS_KINDS.filter((jenis) => !rows.some((row) => row.jenis === jenis));
  if (missing.length === 0) return;

  const timestamp = now();
  await batch(
    missing.map((jenis) => ({
      sql: `insert into lead_processes
              (id, lead_id, jenis, status, sync_status, created_at, updated_at)
            values (?, ?, ?, ?, 'pending', ?, ?)`,
      bind: [uuid(), leadId, jenis, DEFAULT_STATUS[jenis], timestamp, timestamp],
    }))
  );
}

/** Ketiga proses satu lead, urut sesuai desain. */
export async function listProcesses(leadId: string): Promise<ProcessRow[]> {
  await ensureReady();
  await ensureProcesses(leadId);

  const rows = await select<ProcessRow>(
    "select * from lead_processes where lead_id = ? and deleted_at is null",
    [leadId]
  );

  return PROCESS_KINDS.map((jenis) => rows.find((row) => row.jenis === jenis)).filter(
    (row): row is ProcessRow => row !== undefined
  );
}

function enqueue(recordId: string, payload: unknown): Statement {
  return {
    sql: `insert into sync_operations
            (id, client_op_id, table_name, record_id, operation, payload, created_at)
          values (?, ?, 'lead_processes', ?, 'update', ?, ?)`,
    bind: [uuid(), uuid(), recordId, JSON.stringify(payload), now()],
  };
}

/**
 * Tandai satu proses mulai dikerjakan.
 *
 * Hanya berlaku sekali: proses yang sudah berjalan, sudah selesai, atau masih
 * terkunci dibiarkan apa adanya, sehingga membuka ulang halamannya tidak
 * menimpa `dimulai_at` dan tidak menambah antrean sinkronisasi.
 */
export async function startProcess(
  leadId: string,
  jenis: ProcessKind,
  agentName: string | null
): Promise<void> {
  await ensureReady();
  await ensureProcesses(leadId);

  const rows = await select<ProcessRow>(
    "select * from lead_processes where lead_id = ? and jenis = ? and deleted_at is null",
    [leadId, jenis]
  );

  const row = rows[0];
  if (!row || row.status !== "Belum dimulai") return;

  const timestamp = now();
  const status: ProcessStatus = "Sedang berjalan";

  await batch([
    {
      sql: `update lead_processes
            set status = ?, dimulai_at = ?, updated_by = ?,
                sync_status = 'pending', updated_at = ?
            where id = ?`,
      bind: [status, timestamp, agentName, timestamp, row.id],
    },
    enqueue(row.id, {
      id: row.id,
      lead_id: leadId,
      jenis,
      status,
      dimulai_at: timestamp,
      updated_by: agentName,
    }),
  ]);
}
