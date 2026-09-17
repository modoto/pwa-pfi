"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Download, RefreshCw, TriangleAlert } from "lucide-react";
import { fetchMasterChecksums, fetchMasterData } from "@/app/actions/master-data";
import { MASTER_SOURCES } from "@/lib/master-data";
import {
  listMasterSyncs,
  recordMasterError,
  saveMaster,
  type MasterSyncRow,
} from "@/lib/db/master-repo";

type Status = Record<
  string,
  { rows?: number; error?: string; berjalan?: boolean; dilewati?: boolean }
>;

function waktu(nilai: string | null): string {
  if (!nilai) return "belum pernah";

  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return nilai;

  return tanggal.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Penarik master data dari API ke database lokal (daftarnya di
 * src/lib/master-data.ts).
 *
 * Ditarik satu per satu, bukan sekaligus: sebagian master besar (kelurahan
 * ±84 ribu baris) dan beberapa endpoint diketahui rusak, jadi kemajuannya perlu
 * terlihat dan kegagalan satu master tidak boleh menghentikan sisanya.
 *
 * Sejak 2026-09-16 API punya `/api/mobile/SyncCheckSum/sync` yang memberi
 * checksum isi tiap tabel. Tabel yang checksum-nya sama dengan tarikan terakhir
 * dilewati, jadi penarikan ulang jauh lebih ringan. Tombol "Tarik ulang semua"
 * mengabaikan checksum bila datanya perlu dipaksa muat ulang.
 */
export function MasterDataSync() {
  const [status, setStatus] = useState<Status>({});
  const [tersimpan, setTersimpan] = useState<Record<string, MasterSyncRow>>({});
  const [berjalan, setBerjalan] = useState(false);
  const [sedang, setSedang] = useState("");
  const [catatan, setCatatan] = useState("");

  const muat = useCallback(async () => {
    try {
      const rows = await listMasterSyncs();
      setTersimpan(Object.fromEntries(rows.map((row) => [row.nama_tabel, row])));
    } catch {
      // Riwayat gagal dibaca bukan alasan menyembunyikan tombolnya.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void muat();
  }, [muat]);

  async function tarikSatu(
    source: (typeof MASTER_SOURCES)[number],
    checksum: string | null
  ) {
    setStatus((prev) => ({ ...prev, [source.table]: { berjalan: true } }));

    const hasil = await fetchMasterData(source.endpoint);

    if (!hasil.ok) {
      await recordMasterError(source.table, hasil.message);
      setStatus((prev) => ({ ...prev, [source.table]: { error: hasil.message } }));
      return;
    }

    try {
      const { rows } = await saveMaster(source.table, hasil.rows, checksum);
      setStatus((prev) => ({ ...prev, [source.table]: { rows } }));
    } catch (error) {
      const pesan = error instanceof Error ? error.message : "Gagal menyimpan ke database lokal.";
      await recordMasterError(source.table, pesan);
      setStatus((prev) => ({ ...prev, [source.table]: { error: pesan } }));
    }
  }

  /**
   * @param paksa tarik semua tabel walau checksum-nya tidak berubah.
   */
  async function tarikSemua(paksa = false) {
    setBerjalan(true);
    setStatus({});
    setCatatan("");

    // Checksum bersifat opsional: kalau endpointnya gagal, semua tetap ditarik.
    let checksums: Record<string, string> = {};
    if (!paksa) {
      setSedang("checksum");
      const hasil = await fetchMasterChecksums();
      if (hasil.ok) checksums = hasil.checksums;
      else setCatatan(`Checksum tidak terbaca (${hasil.message}); semua master ditarik ulang.`);
    }

    for (const source of MASTER_SOURCES) {
      const server = checksums[source.table] ?? null;
      const lokal = tersimpan[source.table];
      const sama =
        server !== null &&
        lokal?.checksum === server &&
        lokal.jumlah_baris !== null &&
        !lokal.pesan_error;

      if (sama) {
        setStatus((prev) => ({ ...prev, [source.table]: { dilewati: true } }));
        continue;
      }

      setSedang(source.label);
      await tarikSatu(source, server);
    }

    setSedang("");
    setBerjalan(false);
    await muat();
  }

  const selesai = Object.values(status).filter((item) => !item.berjalan).length;
  const gagal = Object.values(status).filter((item) => item.error).length;
  const dilewati = Object.values(status).filter((item) => item.dilewati).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Menarik {MASTER_SOURCES.length} master data dari API dan menyimpannya ke database lokal.
        Kolom tiap tabel mengikuti bentuk data dari API dan menyesuaikan sendiri bila field di
        API berubah. Tabel yang checksum-nya sama dengan tarikan terakhir dilewati. Data agen,
        pengguna, lead, dan OTP reset password tidak ikut ditarik.
      </p>

      {catatan && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{catatan}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void tarikSemua()}
          disabled={berjalan}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          {berjalan ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {berjalan ? `Menarik ${sedang} …` : "Tarik master data yang berubah"}
        </button>

        <button
          type="button"
          onClick={() => void tarikSemua(true)}
          disabled={berjalan}
          className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          <RefreshCw className="size-4" aria-hidden />
          Tarik ulang semua
        </button>

        {selesai > 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {selesai} dari {MASTER_SOURCES.length} selesai
            {dilewati > 0 ? `, ${dilewati} tidak berubah` : ""}
            {gagal > 0 ? `, ${gagal} gagal` : ""}
          </p>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Master</th>
              <th className="px-4 py-2.5 font-semibold">Tabel</th>
              <th className="px-4 py-2.5 text-right font-semibold">Baris</th>
              <th className="px-4 py-2.5 font-semibold">Terakhir ditarik</th>
            </tr>
          </thead>

          <tbody>
            {MASTER_SOURCES.map((source) => {
              const kini = status[source.table];
              const riwayat = tersimpan[source.table];
              const error = kini?.error ?? (kini ? null : riwayat?.pesan_error);
              const baris = kini?.rows ?? (kini?.error ? null : riwayat?.jumlah_baris ?? null);

              return (
                <tr
                  key={source.table}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      {kini?.berjalan ? (
                        <RefreshCw className="size-3.5 shrink-0 animate-spin text-slate-400" aria-hidden />
                      ) : kini?.dilewati ? (
                        <Check className="size-3.5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
                      ) : error ? (
                        <TriangleAlert className="size-3.5 shrink-0 text-amber-500" aria-hidden />
                      ) : baris !== null && baris !== undefined ? (
                        <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
                      ) : (
                        <span className="size-3.5 shrink-0" />
                      )}
                      {source.label}
                    </span>
                    {error && (
                      <span className="mt-1 block text-xs text-amber-600 dark:text-amber-400">
                        {error}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {source.table}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {baris === null || baris === undefined ? "–" : baris.toLocaleString("id-ID")}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    {kini?.dilewati ? "tidak berubah" : waktu(riwayat?.ditarik_at ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
