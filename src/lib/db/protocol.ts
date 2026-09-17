/** Kontrak pesan antara worker database dan pemanggilnya di main thread. */

/** Uint8Array dipakai untuk kolom BLOB (mis. lampiran gambar aktivitas). */
export type SqlValue = string | number | null | Uint8Array;

export type Statement = {
  sql: string;
  bind?: SqlValue[];
};

export type DbRequest =
  | { id: number; type: "init" }
  | { id: number; type: "select"; statement: Statement }
  | { id: number; type: "run"; statement: Statement }
  /** Dijalankan dalam satu transaksi — semua berhasil, atau semua dibatalkan. */
  | { id: number; type: "batch"; statements: Statement[] }
  /** Salinan mentah berkas .sqlite3 dari OPFS, untuk diunduh dan diperiksa. */
  | { id: number; type: "export" };

export type DbResponse =
  | { id: number; ok: true; data: unknown }
  | { id: number; ok: false; error: string };
