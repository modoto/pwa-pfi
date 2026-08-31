"use client";

/**
 * Jembatan promise ke worker database.
 *
 * Worker dibuat sekali per tab dan dipakai bersama oleh seluruh halaman.
 */

import type { DbRequest, DbResponse, Statement } from "./protocol";

/** Omit biasa pada union akan meruntuhkannya jadi properti bersama saja. */
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (typeof window === "undefined") {
    throw new Error("Database lokal hanya tersedia di browser.");
  }

  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

    worker.onmessage = (event: MessageEvent<DbResponse>) => {
      const response = event.data;
      const waiting = pending.get(response.id);
      if (!waiting) return;

      pending.delete(response.id);
      if (response.ok) waiting.resolve(response.data);
      else waiting.reject(new Error(response.error));
    };

    // Tanpa ini, handle OPFS masih dipegang worker lama saat halaman berikutnya
    // membuka database — dan SQLite gagal dengan "another open Access Handle".
    window.addEventListener("pagehide", release);

    worker.onerror = (event) => {
      const error = new Error(event.message || "Worker database gagal dimuat.");
      for (const waiting of pending.values()) waiting.reject(error);
      pending.clear();
    };
  }

  return worker;
}

/** Hentikan worker dan lepaskan seluruh access handle OPFS yang dipegangnya. */
function release() {
  if (!worker) return;

  worker.terminate();
  worker = null;

  const error = new Error("Database lokal ditutup.");
  for (const waiting of pending.values()) waiting.reject(error);
  pending.clear();
}

function request<T>(message: WithoutId<DbRequest>): Promise<T> {
  const id = ++nextId;
  const active = getWorker();

  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
    active.postMessage({ ...message, id } as DbRequest);
  });
}

/** Buka database dan jalankan migrasi yang tertunda. */
export function initDb() {
  return request<{ version: number }>({ type: "init" });
}

export function select<T>(sql: string, bind: Statement["bind"] = []) {
  return request<T[]>({ type: "select", statement: { sql, bind } });
}

export function run(sql: string, bind: Statement["bind"] = []) {
  return request<{ changes: number }>({ type: "run", statement: { sql, bind } });
}

/** Jalankan beberapa perintah dalam satu transaksi. */
export function batch(statements: Statement[]) {
  return request<{ count: number }>({ type: "batch", statements });
}
