/// <reference lib="webworker" />

/**
 * Worker pemilik database SQLite.
 *
 * SQLite dijalankan sebagai WebAssembly dengan VFS `opfs-sahpool`, sehingga
 * datanya benar-benar tersimpan di disk lewat OPFS dan bertahan setelah tab
 * ditutup. VFS ini sengaja dipilih daripada VFS `opfs` biasa karena tidak
 * menuntut header COOP/COEP — yang kalau dipasang akan mengisolasi halaman dan
 * merepotkan sisa aplikasi.
 *
 * OPFS hanya bisa diakses dari worker, jadi seluruh query melewati file ini.
 */

import { LATEST_VERSION, MIGRATIONS } from "./schema";
import type { DbRequest, DbResponse, Statement } from "./protocol";

/**
 * Bentuk minimal API sqlite3 yang benar-benar dipakai di sini. Runtime-nya
 * dimuat dari /sqlite/sqlite3.mjs saat berjalan (lihat scripts/copy-sqlite.mjs),
 * jadi typing dari paket npm tidak ikut terbawa.
 */
type SqlitePool = { OpfsSAHPoolDb: new (filename: string) => Db };
type SqliteApi = {
  installOpfsSAHPoolVfs: (opts: {
    directory?: string;
    name?: string;
    initialCapacity?: number;
  }) => Promise<SqlitePool>;
};
type SqliteInit = (config?: { locateFile?: (file: string) => string }) => Promise<SqliteApi>;

type Db = {
  exec: (opts: {
    sql: string;
    bind?: unknown[];
    rowMode?: "object" | "array";
    returnValue?: "resultRows" | "this";
  }) => unknown;
  changes: () => number;
  close: () => void;
};

let db: Db | null = null;
let booting: Promise<Db> | null = null;

async function open(): Promise<Db> {
  // Spesifier sengaja lewat variabel: berkasnya baru ada saat runtime di
  // public/, bukan modul yang bisa diselesaikan bundler atau TypeScript.
  const runtimeUrl = "/sqlite/sqlite3.mjs";
  const runtime = (await import(/* turbopackIgnore: true */ runtimeUrl)) as {
    default: SqliteInit;
  };

  const sqlite3 = await runtime.default({
    // Berkas wasm disalin ke public/ supaya jalurnya pasti dan bisa
    // ikut di-cache service worker.
    locateFile: () => "/sqlite/sqlite3.wasm",
  });

  // OPFS hanya mengizinkan satu pemegang access handle per berkas. Saat
  // berpindah halaman, worker lama kadang belum sepenuhnya dilepas browser,
  // jadi percobaan pertama bisa gagal walau tidak ada tab lain.
  const pool = await acquirePool(sqlite3);

  const database = new pool.OpfsSAHPoolDb("/pfi-eaps.sqlite3");

  database.exec({ sql: "pragma foreign_keys = on" });
  migrate(database);

  return database;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquirePool(sqlite3: SqliteApi): Promise<SqlitePool> {
  const MAX_ATTEMPTS = 10;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await sqlite3.installOpfsSAHPoolVfs({
        directory: ".pfi-eaps",
        name: "pfi-eaps",
        initialCapacity: 8,
      });
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          "Database lokal sedang dipakai tab lain. Tutup tab PFI-EAPS yang lain lalu muat ulang halaman ini. " +
            `(${error instanceof Error ? error.message : String(error)})`
        );
      }
      await wait(120 * attempt);
    }
  }

  throw new Error("Tidak dapat membuka database lokal.");
}

/** Jalankan migrasi yang belum pernah dipakai, dicatat di `schema_migrations`. */
function migrate(database: Db) {
  database.exec({
    sql: `create table if not exists schema_migrations (
            version    integer primary key,
            applied_at text not null
          )`,
  });

  const rows = database.exec({
    sql: "select version from schema_migrations order by version desc limit 1",
    rowMode: "object",
    returnValue: "resultRows",
  }) as Array<{ version: number }>;

  const current = rows[0]?.version ?? 0;
  if (current >= LATEST_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    database.exec({ sql: "begin" });
    try {
      for (const sql of migration.statements) database.exec({ sql });
      database.exec({
        sql: "insert into schema_migrations (version, applied_at) values (?, ?)",
        bind: [migration.version, new Date().toISOString()],
      });
      database.exec({ sql: "commit" });
    } catch (error) {
      database.exec({ sql: "rollback" });
      throw error;
    }
  }
}

function ready(): Promise<Db> {
  if (db) return Promise.resolve(db);
  booting ??= open().then((opened) => {
    db = opened;
    return opened;
  });
  return booting;
}

function select(database: Db, statement: Statement) {
  return database.exec({
    sql: statement.sql,
    bind: statement.bind ?? [],
    rowMode: "object",
    returnValue: "resultRows",
  });
}

function run(database: Db, statement: Statement) {
  database.exec({ sql: statement.sql, bind: statement.bind ?? [] });
  return { changes: database.changes() };
}

self.onmessage = async (event: MessageEvent<DbRequest>) => {
  const request = event.data;
  const reply = (response: DbResponse) => self.postMessage(response);

  try {
    const database = await ready();

    switch (request.type) {
      case "init":
        reply({ id: request.id, ok: true, data: { version: LATEST_VERSION } });
        break;

      case "select":
        reply({ id: request.id, ok: true, data: select(database, request.statement) });
        break;

      case "run":
        reply({ id: request.id, ok: true, data: run(database, request.statement) });
        break;

      case "batch": {
        database.exec({ sql: "begin" });
        try {
          for (const statement of request.statements) run(database, statement);
          database.exec({ sql: "commit" });
        } catch (error) {
          database.exec({ sql: "rollback" });
          throw error;
        }
        reply({ id: request.id, ok: true, data: { count: request.statements.length } });
        break;
      }
    }
  } catch (error) {
    reply({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
