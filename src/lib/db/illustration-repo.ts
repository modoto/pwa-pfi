"use client";

/**
 * Isian formulir Sales Illustration (`lead_illustration_fields`).
 *
 * Bentuknya kunci-nilai per langkah; lihat catatan pada migrasi 8. Pola
 * penulisannya sama seperti repo lain: satu baris data dan satu operasi
 * `sync_operations` dalam satu transaksi.
 */

import { batch, select } from "./client";
import type { Statement } from "./protocol";
import { ensureReady } from "./leads-repo";

export type IllustrationFieldRow = {
  id: string;
  server_id: number | null;
  lead_id: string;
  langkah: string;
  field: string;
  nilai: string | null;
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
  operation: "insert" | "update",
  recordId: string,
  payload: unknown
): Statement {
  return {
    sql: `insert into sync_operations
            (id, client_op_id, table_name, record_id, operation, payload, created_at)
          values (?, ?, 'lead_illustration_fields', ?, ?, ?, ?)`,
    bind: [uuid(), uuid(), recordId, operation, JSON.stringify(payload), now()],
  };
}

/** Seluruh isian satu langkah, sebagai peta field → nilai. */
export async function loadStep(
  leadId: string,
  langkah: string
): Promise<Record<string, string>> {
  await ensureReady();

  const rows = await select<IllustrationFieldRow>(
    `select * from lead_illustration_fields
     where lead_id = ? and langkah = ? and deleted_at is null`,
    [leadId, langkah]
  );

  return Object.fromEntries(rows.map((row) => [row.field, row.nilai ?? ""]));
}

/**
 * Simpan beberapa field sekaligus.
 *
 * Nilai yang tidak berubah dilewati supaya antrean sinkronisasi tidak terisi
 * baris yang tidak membawa perubahan apa pun.
 */
export async function saveStep(
  leadId: string,
  langkah: string,
  values: Record<string, string>,
  agentName: string | null
): Promise<void> {
  await ensureReady();

  const rows = await select<IllustrationFieldRow>(
    "select * from lead_illustration_fields where lead_id = ? and langkah = ?",
    [leadId, langkah]
  );

  const timestamp = now();
  const statements: Statement[] = [];

  for (const [field, nilai] of Object.entries(values)) {
    const existing = rows.find((row) => row.field === field);

    if (existing) {
      if ((existing.nilai ?? "") === nilai && existing.deleted_at === null) continue;

      statements.push({
        sql: `update lead_illustration_fields
              set nilai = ?, updated_by = ?, deleted_at = null,
                  sync_status = 'pending', updated_at = ?
              where id = ?`,
        bind: [nilai, agentName, timestamp, existing.id],
      });
      statements.push(
        enqueue("update", existing.id, {
          id: existing.id,
          lead_id: leadId,
          langkah,
          field,
          nilai,
          updated_by: agentName,
        })
      );
      continue;
    }

    if (!nilai) continue;

    const id = uuid();
    statements.push({
      sql: `insert into lead_illustration_fields
              (id, lead_id, langkah, field, nilai, created_by, updated_by,
               sync_status, created_at, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      bind: [id, leadId, langkah, field, nilai, agentName, agentName, timestamp, timestamp],
    });
    statements.push(
      enqueue("insert", id, {
        id,
        lead_id: leadId,
        langkah,
        field,
        nilai,
        created_by: agentName,
        updated_by: agentName,
      })
    );
  }

  if (statements.length > 0) await batch(statements);
}

/**
 * Langkah yang sudah punya isian, untuk menandai kemajuan pada stepper.
 *
 * Kuesioner Profil Resiko tidak menyimpan isiannya di sini — jawabannya
 * dibagi dengan FnA di `lead_fna_answers` — jadi langkah itu diperiksa
 * terpisah oleh pemanggilnya.
 */
export async function stepsWithData(leadId: string): Promise<string[]> {
  await ensureReady();

  const rows = await select<{ langkah: string }>(
    `select distinct langkah from lead_illustration_fields
     where lead_id = ? and deleted_at is null and nilai is not null and nilai <> ''`,
    [leadId]
  );

  return rows.map((row) => row.langkah);
}
