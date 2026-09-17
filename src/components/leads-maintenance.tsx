"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { fetchLeadsFromApi } from "@/app/actions/leads-api";
import {
  importLeads,
  listLeads,
  pendingOperations,
  wipeLeads,
  type ImportLeadsResult,
} from "@/lib/db/leads-repo";

/**
 * Perawatan data lead di halaman Profil: hapus seluruh data lead di perangkat,
 * dan tarik data lead dari API.
 *
 * Endpoint lead di API masih **hanya baca** (per 2026-09-16), jadi menarik data
 * tidak mengubah apa pun di server. Sebaliknya, menghapus di sini tidak bisa
 * dibatalkan — karena itu perlu satu langkah konfirmasi.
 */
export function LeadsMaintenance() {
  const [jumlahLead, setJumlahLead] = useState<number | null>(null);
  const [antrean, setAntrean] = useState<number | null>(null);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [sibuk, setSibuk] = useState<"hapus" | "tarik" | null>(null);
  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");

  const muat = useCallback(async () => {
    try {
      const [leads, operasi] = await Promise.all([listLeads(), pendingOperations()]);
      setJumlahLead(leads.length);
      setAntrean(operasi.length);
    } catch {
      // Jumlahnya hanya informasi; kegagalan membacanya tidak menutup tombol.
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void muat();
  }, [muat]);

  async function hapusSemua() {
    setSibuk("hapus");
    setPesan("");
    setError("");

    try {
      const hasil = await wipeLeads();
      const total = hasil.reduce((jumlah, item) => jumlah + item.dihapus, 0);
      const rincian = hasil
        .filter((item) => item.dihapus > 0)
        .map((item) => `${item.tabel} ${item.dihapus.toLocaleString("id-ID")}`)
        .join(", ");

      setPesan(
        total === 0
          ? "Tidak ada data lead untuk dihapus."
          : `${total.toLocaleString("id-ID")} baris dihapus (${rincian}).`
      );
      setKonfirmasi(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus data lead.");
    } finally {
      setSibuk(null);
      await muat();
    }
  }

  async function tarikDariApi() {
    setSibuk("tarik");
    setPesan("");
    setError("");

    try {
      const hasil = await fetchLeadsFromApi();
      if (!hasil.ok) {
        setError(hasil.message);
        return;
      }

      const ringkas: ImportLeadsResult = await importLeads(hasil.leads, hasil.scores);
      setPesan(
        `${hasil.leads.length.toLocaleString("id-ID")} lead dari API: ` +
          `${ringkas.baru} baru, ${ringkas.diperbarui} diperbarui` +
          (ringkas.dilewati > 0
            ? `, ${ringkas.dilewati} dilewati karena masih ada perubahan lokal.`
            : ".")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan data lead.");
    } finally {
      setSibuk(null);
      await muat();
    }
  }

  const tombolClass =
    "flex h-11 items-center justify-center gap-2 rounded-2xl border px-6 text-sm font-semibold " +
    "transition disabled:opacity-60";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Data lead di perangkat{" "}
        {jumlahLead === null ? "sedang dibaca" : `berisi ${jumlahLead.toLocaleString("id-ID")} lead`}
        {antrean !== null && antrean > 0
          ? ` dan ${antrean.toLocaleString("id-ID")} perubahan yang belum terkirim`
          : ""}
        . Menarik dari API hanya membaca (`GetAllLeads`); lead yang masih punya perubahan lokal
        tidak ditimpa.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void tarikDariApi()}
          disabled={sibuk !== null}
          className={`${tombolClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
        >
          {sibuk === "tarik" ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
          {sibuk === "tarik" ? "Menarik data lead …" : "Tarik data lead dari API"}
        </button>

        <button
          type="button"
          onClick={() => setKonfirmasi(true)}
          disabled={sibuk !== null || konfirmasi}
          className={`${tombolClass} border-rose-200 bg-white text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-400`}
        >
          <Trash2 className="size-4" aria-hidden />
          Hapus semua data lead
        </button>
      </div>

      {konfirmasi && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40">
          <p className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Menghapus tabel <span className="font-mono text-xs">leads</span> beserta turunannya
              (proses, FnA, isian ilustrasi, aktivitas, assignment) dan antrean sinkronisasi.
              Perubahan yang belum terkirim ke server ikut hilang dan tidak bisa dikembalikan.
            </span>
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void hapusSemua()}
              disabled={sibuk !== null}
              className={`${tombolClass} border-rose-600 bg-rose-600 text-white hover:bg-rose-700`}
            >
              {sibuk === "hapus" ? (
                <RefreshCw className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              {sibuk === "hapus" ? "Menghapus …" : "Ya, hapus semua"}
            </button>

            <button
              type="button"
              onClick={() => setKonfirmasi(false)}
              disabled={sibuk !== null}
              className={`${tombolClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200`}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {pesan && <p className="text-sm text-emerald-600 dark:text-emerald-400">{pesan}</p>}
      {error && <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}
