"use client";

/**
 * Tabel `lead_fna_priorities` — empat slot prioritas keuangan pada FnA.
 *
 * Pola sama seperti repo lain: satu baris data dan satu operasi
 * `sync_operations` dalam satu transaksi.
 */

import { batch, select } from "./client";
import type { Statement } from "./protocol";
import { ensureReady } from "./leads-repo";

export type PriorityRow = {
  id: string;
  server_id: number | null;
  lead_id: string;
  urutan: number;
  topik: string;
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

function enqueue(
  table: "lead_fna_priorities" | "lead_fna_answers",
  operation: "insert" | "update",
  recordId: string,
  payload: unknown
): Statement {
  return {
    sql: `insert into sync_operations
            (id, client_op_id, table_name, record_id, operation, payload, created_at)
          values (?, ?, ?, ?, ?, ?, ?)`,
    bind: [uuid(), uuid(), table, recordId, operation, JSON.stringify(payload), now()],
  };
}

export async function listPriorities(leadId: string): Promise<PriorityRow[]> {
  await ensureReady();
  return select<PriorityRow>(
    `select * from lead_fna_priorities
     where lead_id = ? and deleted_at is null
     order by urutan asc`,
    [leadId]
  );
}

/**
 * Isi atau ganti satu slot prioritas.
 *
 * Slot yang sudah terisi ditimpa, bukan ditambah baris baru — indeks unik
 * `(lead_id, urutan)` menjaga satu topik per slot.
 */
export async function setPriority(
  leadId: string,
  urutan: number,
  topik: string,
  agentName: string | null
): Promise<void> {
  await ensureReady();

  const rows = await select<PriorityRow>(
    "select * from lead_fna_priorities where lead_id = ? and urutan = ?",
    [leadId, urutan]
  );

  const timestamp = now();
  const existing = rows[0];

  if (existing) {
    await batch([
      {
        sql: `update lead_fna_priorities
              set topik = ?, updated_by = ?, deleted_at = null,
                  sync_status = 'pending', updated_at = ?
              where id = ?`,
        bind: [topik, agentName, timestamp, existing.id],
      },
      enqueue("lead_fna_priorities", "update", existing.id, {
        id: existing.id,
        lead_id: leadId,
        urutan,
        topik,
        updated_by: agentName,
      }),
    ]);
    return;
  }

  const id = uuid();
  await batch([
    {
      sql: `insert into lead_fna_priorities
              (id, lead_id, urutan, topik, created_by, updated_by,
               sync_status, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      bind: [id, leadId, urutan, topik, agentName, agentName, timestamp, timestamp],
    },
    enqueue("lead_fna_priorities", "insert", id, {
      id,
      lead_id: leadId,
      urutan,
      topik,
      created_by: agentName,
      updated_by: agentName,
    }),
  ]);
}

export type AnswerRow = {
  id: string;
  server_id: number | null;
  lead_id: string;
  topik: string;
  pertanyaan: string;
  jawaban: string;
  created_by: string | null;
  updated_by: string | null;
  sync_status: string;
  created_at: string;
  updated_at: string;
  server_updated_at: string | null;
  deleted_at: string | null;
};

export async function listAnswers(leadId: string, topik: string): Promise<AnswerRow[]> {
  await ensureReady();
  return select<AnswerRow>(
    `select * from lead_fna_answers
     where lead_id = ? and topik = ? and deleted_at is null`,
    [leadId, topik]
  );
}

/** Simpan jawaban satu pertanyaan; jawaban lama untuk pertanyaan itu ditimpa. */
export async function setAnswer(
  leadId: string,
  topik: string,
  pertanyaan: string,
  jawaban: string,
  agentName: string | null
): Promise<void> {
  await ensureReady();

  const rows = await select<AnswerRow>(
    "select * from lead_fna_answers where lead_id = ? and topik = ? and pertanyaan = ?",
    [leadId, topik, pertanyaan]
  );

  const timestamp = now();
  const existing = rows[0];

  if (existing) {
    await batch([
      {
        sql: `update lead_fna_answers
              set jawaban = ?, updated_by = ?, deleted_at = null,
                  sync_status = 'pending', updated_at = ?
              where id = ?`,
        bind: [jawaban, agentName, timestamp, existing.id],
      },
      enqueue("lead_fna_answers", "update", existing.id, {
        id: existing.id,
        lead_id: leadId,
        topik,
        pertanyaan,
        jawaban,
        updated_by: agentName,
      }),
    ]);
    return;
  }

  const id = uuid();
  await batch([
    {
      sql: `insert into lead_fna_answers
              (id, lead_id, topik, pertanyaan, jawaban, created_by, updated_by,
               sync_status, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      bind: [id, leadId, topik, pertanyaan, jawaban, agentName, agentName, timestamp, timestamp],
    },
    enqueue("lead_fna_answers", "insert", id, {
      id,
      lead_id: leadId,
      topik,
      pertanyaan,
      jawaban,
      created_by: agentName,
      updated_by: agentName,
    }),
  ]);
}
