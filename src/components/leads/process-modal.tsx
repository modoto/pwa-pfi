"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { ChartPie, Lightbulb, Rocket, TabletSmartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { listProcesses, type ProcessKind, type ProcessRow } from "@/lib/db/processes-repo";

/**
 * Judul dan ikon tiap proses.
 *
 * Ilustrasi desain belum diekspor dari Figma; sementara memakai ikon lucide
 * dengan tata letak yang sama, jadi penggantiannya nanti cukup di blok ini.
 */
const PROCESSES: Record<ProcessKind, { title: string; icon: typeof Rocket }> = {
  analisis: { title: "Analisis Kebutuhan dan Keuangan & Rekomendasi Produk", icon: ChartPie },
  ilustrasi: { title: "Sales Illustration", icon: Lightbulb },
  eapp: { title: "E-App", icon: TabletSmartphone },
};

/** Proses yang belum dibuka tampil abu-abu dan tidak bisa dikerjakan. */
const isLocked = (row: ProcessRow) => row.status === "Belum dibuka";

function ProcessCard({ row, leadId }: { row: ProcessRow; leadId: string }) {
  const { title, icon: Icon } = PROCESSES[row.jenis];
  const locked = isLocked(row);

  // E-App belum punya halaman; Sales Illustration baru placeholder.
  const href =
    row.jenis === "analisis"
      ? `/leads/details/${leadId}/fna`
      : row.jenis === "ilustrasi"
        ? `/leads/details/${leadId}/sales-illustration`
        : null;

  const className = cn(
    "flex items-center justify-between gap-4 rounded-[14px] p-5 sm:p-6",
    locked ? "bg-pfi-proses-lock" : "bg-pfi-proses",
    href && "transition hover:bg-pfi-proses/90"
  );

  const isi = (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <p
          className={cn(
            "text-lg font-bold sm:text-xl",
            locked ? "text-pfi-muted" : "text-white"
          )}
        >
          {title}
        </p>
        <p className={cn("text-sm", locked ? "text-pfi-subtle" : "text-white/85")}>
          {row.status}
        </p>
      </div>

      <span
        className={cn(
          "grid size-24 shrink-0 place-items-center rounded-[10px] sm:size-28",
          locked ? "bg-pfi-proses-lock-alt text-pfi-subtle" : "bg-pfi-tint-alt text-pfi-proses"
        )}
      >
        <Icon className="size-10" aria-hidden />
      </span>
    </>
  );

  if (!href) {
    return (
      <div aria-disabled={locked} className={className}>
        {isi}
      </div>
    );
  }

  return (
    <Link href={href} className={className}>
      {isi}
    </Link>
  );
}

/**
 * Modal Mulai Proses.
 *
 * Menampilkan status ketiga proses dari `lead_processes`. Baru kartu Analisis
 * yang punya halaman (FnA); dua sisanya menunggu desain.
 */
export function ProcessModal({
  leadId,
  leadName,
  leadCode,
  onClose,
}: {
  leadId: string;
  leadName: string;
  leadCode: string | null;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const titleId = useId();

  const load = useCallback(async () => {
    try {
      setRows(await listProcesses(leadId));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membaca database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-pfi-hairline px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-pfi-tint text-pfi-link">
              <Rocket className="size-6" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
                Mulai Proses
              </h2>
              <p className="truncate text-sm text-pfi-muted">
                {leadName}
                {leadCode ? ` · ${leadCode}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5 sm:px-6">
          {state === "error" ? (
            <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
              {message}
            </p>
          ) : state === "loading" ? (
            <p className="py-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
          ) : (
            <>
              <p className="text-center text-base text-pfi-heading">
                Pilih salah satu tab untuk memulai
              </p>
              {rows.map((row) => (
                <ProcessCard key={row.id} row={row} leadId={leadId} />
              ))}
            </>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-pfi-hairline px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline"
          >
            Batalkan
          </button>
        </footer>
      </div>
    </div>
  );
}
