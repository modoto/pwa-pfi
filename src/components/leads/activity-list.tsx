"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { CircleAlert, Crosshair, Pencil, Plus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACTIVITY_STATUSES,
  JENIS_AKTIVITAS,
  listActivities,
  type ActivityRow,
  type ActivityStatus,
} from "@/lib/db/activities-repo";
import { ActivityModal } from "@/components/leads/activity-modal";

const STATUS_STYLE: Record<
  ActivityStatus,
  { chip: string; border: string; dot: string; action: string }
> = {
  Terjadwal: {
    chip: "bg-status-blue-bg text-status-blue-fg",
    border: "border-l-pfi-accent",
    dot: "bg-pfi-accent",
    action: "border-pfi-link text-pfi-link hover:bg-pfi-tint",
  },
  "Perlu Update": {
    chip: "bg-status-orange-bg text-pfi-amber",
    border: "border-l-pfi-amber",
    dot: "bg-pfi-amber",
    action: "border-pfi-amber text-pfi-amber hover:bg-status-orange-bg",
  },
  Selesai: {
    chip: "bg-status-green-bg text-status-green-fg",
    border: "border-l-status-green-fg",
    dot: "bg-status-green-fg",
    action: "border-pfi-line text-pfi-muted hover:bg-pfi-hairline",
  },
};

/** ISO (yyyy-mm-dd) → dd/mm/yyyy. */
function formatDate(value: string | null) {
  if (!value) return "–";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatStamp(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-pfi-muted">{label}</p>
      <p className="text-sm text-pfi-heading">{value}</p>
    </div>
  );
}

/** Ubah BLOB gambar jadi URL objek, dan lepaskan lagi saat tidak dipakai. */
function useImageUrl(row: ActivityRow) {
  const url = useMemo(() => {
    if (!row.gambar || row.gambar.byteLength === 0) return null;

    return URL.createObjectURL(
      new Blob([row.gambar as BlobPart], { type: row.gambar_tipe ?? "image/jpeg" })
    );
  }, [row.gambar, row.gambar_tipe]);

  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return url;
}

function ActivityCard({
  row,
  onEdit,
}: {
  row: ActivityRow;
  onEdit: (row: ActivityRow) => void;
}) {
  const style = STATUS_STYLE[row.status] ?? STATUS_STYLE.Terjadwal;
  const imageUrl = useImageUrl(row);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[10px] border border-pfi-hairline border-l-[3px] bg-white",
        style.border
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h3 className="truncate text-base font-bold text-pfi-heading">
            {row.jenis_aktivitas}
          </h3>
          <p className="truncate text-sm text-pfi-muted">{row.keterangan ?? "–"}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-[60px] px-2.5 py-1.5 text-xs font-medium whitespace-nowrap",
            style.chip
          )}
        >
          {row.status}
        </span>
      </div>

      <div className="grid gap-4 border-t border-pfi-hairline p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Cell label="Tanggal" value={formatDate(row.tanggal)} />
        <Cell label="Waktu" value={row.waktu ?? "–"} />
        <Cell label="Lokasi" value={row.lokasi_rencana ?? "–"} />
        <Cell label="Catatan" value={row.catatan ?? "–"} />
      </div>

      {row.status === "Perlu Update" && (
        <p className="mx-4 mb-4 flex items-center gap-2.5 rounded-[10px] bg-status-orange-bg px-4 py-3 text-sm text-pfi-amber">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          Hasil kunjungan belum dilengkapi
        </p>
      )}

      {row.lokasi_aktual && (
        <p className="mx-4 mb-4 flex items-center gap-2.5 rounded-[10px] bg-status-green-bg px-4 py-3 text-sm text-status-green-fg">
          <Crosshair className="size-4 shrink-0" aria-hidden />
          Lokasi Aktual : {row.lokasi_aktual}
        </p>
      )}

      {imageUrl && (
        <div className="mx-4 mb-4 flex items-center gap-3">
          <Image
            src={imageUrl}
            alt={row.gambar_nama ?? "Lampiran aktivitas"}
            width={56}
            height={42}
            unoptimized
            className="size-[42px] rounded object-cover"
          />
          <span className="text-sm text-pfi-muted">1 gambar terlampir</span>
        </div>
      )}

      {row.catatan_tambahan && (
        <p className="mx-4 mb-4 rounded-[10px] border border-pfi-hairline bg-white px-4 py-3 text-sm text-pfi-heading">
          {row.catatan_tambahan}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-pfi-hairline px-4 py-3 text-sm text-pfi-muted">
        <span>
          Dibuat Oleh : {row.created_by ?? "–"}, {formatStamp(row.created_at)}
        </span>
        <span className="hidden h-4 w-px bg-pfi-line sm:block" aria-hidden />
        <span>
          Diubah Oleh : {row.updated_by ?? "–"}, {formatStamp(row.updated_at)}
        </span>
      </div>

      {row.status !== "Selesai" && (
        <div className="p-4 pt-0">
          <button
            type="button"
            onClick={() => onEdit(row)}
            className={cn(
              "flex w-full items-center justify-center gap-2.5 rounded-[10px] border bg-white px-4 py-3 text-sm font-medium transition",
              style.action
            )}
          >
            <Pencil className="size-4" aria-hidden />
            {row.status === "Perlu Update" ? "Lengkapi Data Aktivitas" : "Edit Aktivitas"}
          </button>
        </div>
      )}
    </article>
  );
}

export function ActivityList({
  leadId,
  leadName,
  leadCode,
  agentName,
}: {
  leadId: string;
  leadName: string;
  leadCode: string | null;
  agentName: string | null;
}) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [error, setError] = useState("");
  const [jenis, setJenis] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState<{ open: boolean; activity?: ActivityRow }>({ open: false });

  const reload = useCallback(async () => {
    try {
      setRows(await listActivities(leadId));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Gagal membuka database lokal.");
      setRows([]);
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void reload();
  }, [reload]);

  const counts = useMemo(() => {
    const tally = { Terjadwal: 0, "Perlu Update": 0, Selesai: 0 } as Record<ActivityStatus, number>;
    for (const row of rows ?? []) tally[row.status] = (tally[row.status] ?? 0) + 1;
    return tally;
  }, [rows]);

  const filtered = (rows ?? []).filter(
    (row) => (!jenis || row.jenis_aktivitas === jenis) && (!status || row.status === status)
  );

  const selectClass =
    "w-full appearance-none rounded-[10px] border border-pfi-line bg-white bg-[url('/leads/arrow-down.svg')] " +
    "bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat px-3.5 py-3 pr-12 text-sm text-pfi-heading " +
    "outline-none transition focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15 sm:w-[248px]";

  return (
    <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
      <header className="flex flex-col gap-4 border-b border-pfi-hairline p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3.5">
          <UserCog className="size-5 shrink-0 text-pfi-link" aria-hidden />
          <h2 className="text-base font-bold text-pfi-heading">Daftar Aktivitas</h2>
        </div>

        <button
          type="button"
          onClick={() => setModal({ open: true })}
          className="flex items-center justify-center gap-3 rounded-[10px] bg-pfi-orange px-4 py-3 text-sm font-medium text-white transition hover:bg-pfi-orange-dark"
        >
          <Plus className="size-4" aria-hidden />
          Buat Aktivitas
        </button>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={jenis}
              onChange={(event) => setJenis(event.target.value)}
              aria-label="Saring jenis aktivitas"
              className={selectClass}
            >
              <option value="">Semua Jenis Aktivitas</option>
              {JENIS_AKTIVITAS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Saring status aktivitas"
              className={selectClass}
            >
              <option value="">Semua Status</option>
              {ACTIVITY_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {ACTIVITY_STATUSES.map((option) => (
              <span
                key={option}
                className="flex items-center gap-2.5 rounded-[60px] border border-pfi-line px-3.5 py-2.5 text-sm text-pfi-heading"
              >
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", STATUS_STYLE[option].dot)}
                />
                {option}
                <span className="font-semibold">{counts[option] ?? 0}</span>
              </span>
            ))}
          </div>
        </div>

        {rows === null ? (
          <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
        ) : error ? (
          <p className="py-10 text-center text-sm font-medium text-pfi-down-fg">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-pfi-muted">
            {rows.length === 0
              ? "Belum ada aktivitas untuk lead ini."
              : "Tidak ada aktivitas yang cocok dengan filter."}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((row) => (
              <ActivityCard
                key={row.id}
                row={row}
                onEdit={(activity) => setModal({ open: true, activity })}
              />
            ))}
          </div>
        )}
      </div>

      {modal.open && (
        <ActivityModal
          leadId={leadId}
          leadName={leadName}
          leadCode={leadCode}
          agentName={agentName}
          activity={modal.activity}
          onClose={() => setModal({ open: false })}
          onSaved={reload}
        />
      )}
    </section>
  );
}
