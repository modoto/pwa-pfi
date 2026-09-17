"use client";

/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  LEAD_CATEGORIES,
  LEAD_STATUSES,
  PAGE_SIZE,
  STATUS_TONE,
  type LeadStatus,
} from "@/lib/leads-data";
import {
  deleteLead,
  duplicateLead,
  listLeads,
  pendingOperations,
  type LeadRow,
} from "@/lib/db/leads-repo";

const TONE_CLASS = {
  blue: "bg-status-blue-bg border-status-blue-border text-status-blue-fg",
  purple: "bg-status-purple-bg border-status-purple-border text-status-purple-fg",
  orange: "bg-status-orange-bg border-status-orange-border text-status-orange-fg",
  red: "bg-status-red-bg border-status-red-border text-status-red-fg",
  green: "bg-status-green-bg border-status-green-border text-status-green-fg",
} as const;

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[60px] border px-2.5 py-1.5 text-sm font-medium whitespace-nowrap",
        TONE_CLASS[STATUS_TONE[status] ?? "blue"]
      )}
    >
      {status}
    </span>
  );
}

type RowAction = { key: string; label: string; icon: string; separated?: boolean };

const ROW_ACTIONS: RowAction[] = [
  { key: "detail", label: "Lihat Detail", icon: "/leads/menu-detail.svg" },
  { key: "edit", label: "Edit", icon: "/leads/menu-edit.svg" },
  { key: "duplicate", label: "Duplikat Lead", icon: "/leads/menu-duplicate.svg" },
  { key: "delete", label: "Hapus", icon: "/leads/menu-delete.svg", separated: true },
];

function RowMenu({
  lead,
  onDuplicate,
  onDelete,
}: {
  lead: LeadRow;
  onDuplicate: (id: string) => void;
  onDelete: (lead: LeadRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Aksi untuk ${lead.nama_depan}`}
        className={cn(
          "grid size-[38px] place-items-center rounded-[10px] transition",
          open ? "bg-pfi-tint" : "hover:bg-pfi-hairline"
        )}
      >
        <img src="/leads/dots.svg" alt="" aria-hidden className="size-[18px] max-w-none object-contain" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 flex w-[200px] flex-col gap-2.5 rounded-[10px] border border-pfi-line bg-white p-2.5 shadow-menu"
        >
          {ROW_ACTIONS.map((action) =>
            action.key === "detail" || action.key === "edit" ? (
              <Link
                key={action.key}
                href={
                  action.key === "detail"
                    ? `/leads/details/${lead.id}`
                    : `/leads/edit/${lead.id}`
                }
                role="menuitem"
                className="flex w-full items-center gap-5 rounded-lg p-2.5 text-left text-sm font-medium text-pfi-muted transition hover:bg-pfi-hairline"
              >
                <img src={action.icon} alt="" aria-hidden className="size-[18px] max-w-none object-contain" />
                {action.label}
              </Link>
            ) : (
            <div key={action.key} className="contents">
              {action.separated && <div className="border-t border-pfi-line" />}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (action.key === "duplicate") onDuplicate(lead.id);
                  if (action.key === "delete") onDelete(lead);
                }}
                className="flex w-full items-center gap-5 rounded-lg p-2.5 text-left text-sm font-medium text-pfi-muted transition hover:bg-pfi-hairline"
              >
                <img src={action.icon} alt="" aria-hidden className="size-[18px] max-w-none object-contain" />
                {action.label}
              </button>
            </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

const COLUMNS = [
  { key: "no", label: "No", className: "w-[50px] justify-center text-center" },
  { key: "name", label: "Nama Lead", className: "w-[180px]" },
  { key: "phone", label: "Nomor Telepon", className: "w-[161px]" },
  { key: "category", label: "Kategori", className: "w-[161px]" },
  { key: "source", label: "Sumber", className: "w-[150px]" },
  { key: "status", label: "Status", className: "w-[190px]" },
  { key: "spaj", label: "No SPAJ", className: "w-[116px]" },
  { key: "policy", label: "No Polis", className: "w-[115px]" },
  { key: "inforce", label: "Tgl Inforce", className: "w-[116px]" },
];

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <div className="relative w-full sm:w-[220px]">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full appearance-none rounded-[10px] border border-pfi-hairline bg-white px-4 py-3.5 pr-11 text-sm text-pfi-heading outline-none transition focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15"
      >
        <option value="">{label}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <img
        src="/leads/arrow-down.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 size-6 max-w-none object-contain -translate-y-1/2"
      />
    </div>
  );
}

export function LeadsTable() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const [toDelete, setToDelete] = useState<LeadRow | null>(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const reload = useCallback(async () => {
    try {
      const [rows, queue] = await Promise.all([listLeads(), pendingOperations()]);
      setLeads(rows);
      setPendingSync(queue.length);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Gagal membuka database lokal."
      );
      setLeads([]);
    }
  }, []);

  useEffect(() => {
    // Database lokal adalah sistem eksternal dan state baru diubah setelah
    // query selesai, bukan sinkron saat efek berjalan — aturan ini tidak bisa
    // melihat batas await di dalam reload().
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void reload();
  }, [reload]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      await duplicateLead(id);
      await reload();
    },
    [reload]
  );

  const handleDelete = useCallback(async () => {
    if (!toDelete) return;
    await deleteLead(toDelete.id);
    await reload();
  }, [toDelete, reload]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return (leads ?? []).filter((lead) => {
      const nama = [lead.nama_depan, lead.nama_tengah, lead.nama_belakang]
        .filter(Boolean)
        .join(" ");

      const matchKeyword =
        !keyword ||
        nama.toLowerCase().includes(keyword) ||
        (lead.lead_code ?? "").toLowerCase().includes(keyword) ||
        (lead.nomor_telepon ?? "").includes(keyword);

      return (
        matchKeyword &&
        (!category || lead.kategori === category) &&
        (!status || lead.status === status)
      );
    });
  }, [leads, query, category, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);

  // Setiap kali filter berubah, kembali ke halaman pertama.
  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Filter */}
      <div className="flex flex-col gap-5 rounded-[14px] border border-pfi-hairline bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3 rounded-[10px] border border-pfi-hairline bg-white p-3">
          <img src="/leads/search.svg" alt="" aria-hidden className="size-5 max-w-none object-contain shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              resetPage();
            }}
            placeholder="Pencarian"
            aria-label="Cari lead"
            className="min-w-0 flex-1 bg-transparent text-sm text-pfi-heading outline-none placeholder:text-pfi-search"
          />
        </div>

        <Select
          label="Semua Kategori"
          value={category}
          options={LEAD_CATEGORIES}
          onChange={(value) => {
            setCategory(value);
            resetPage();
          }}
        />
        <Select
          label="Semua Status"
          value={status}
          options={LEAD_STATUSES}
          onChange={(value) => {
            setStatus(value);
            resetPage();
          }}
        />
      </div>

      {/* Tabel */}
      <div className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white">
        <div className="overflow-x-auto">
          {/* `w-max` membuat pembungkus selebar isinya (jumlah lebar kolom),
              `min-w-full` menjaganya tetap selebar layar saat ada ruang lebih.
              Tanpa itu latar baris kepala berhenti sebelum kolom terakhir. */}
          <div className="w-max min-w-full">
            <div className="flex items-center border-b border-pfi-hairline bg-pfi-thead p-2.5">
              {COLUMNS.map((column) => (
                <div
                  key={column.key}
                  className={cn(
                    "flex shrink-0 items-center p-2.5 text-sm font-semibold uppercase text-pfi-heading",
                    column.className
                  )}
                >
                  {column.label}
                </div>
              ))}
              <div className="w-[58px] shrink-0" />
            </div>

            {leads === null ? (
              <p className="p-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>
            ) : loadError ? (
              <p className="p-10 text-center text-sm font-medium text-pfi-down-fg">{loadError}</p>
            ) : rows.length === 0 ? (
              <p className="p-10 text-center text-sm text-pfi-muted">
                Tidak ada lead yang cocok dengan pencarian Anda.
              </p>
            ) : (
              rows.map((lead, index) => (
                <div
                  key={lead.id}
                  className="flex items-center border-b border-pfi-hairline bg-white p-2.5 transition hover:bg-pfi-bg"
                >
                  <div className="flex w-[50px] shrink-0 items-center justify-center p-2.5 text-sm text-pfi-heading tabular-nums">
                    {start + index + 1}
                  </div>

                  <div className="flex w-[180px] shrink-0 flex-col gap-2.5 p-2.5 text-sm">
                    <span className="truncate font-medium text-pfi-heading">
                      {[lead.nama_depan, lead.nama_tengah, lead.nama_belakang]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                    <span className="text-pfi-subtle">{lead.lead_code ?? "-"}</span>
                  </div>

                  <div className="w-[161px] shrink-0 p-2.5 text-sm text-pfi-heading tabular-nums">
                    {lead.nomor_telepon ?? "-"}
                  </div>

                  <div className="w-[161px] shrink-0 p-2.5">
                    {lead.kategori ? (
                      <span className="inline-flex items-center justify-center rounded-[10px] border border-pfi-chip-border bg-pfi-chip-bg p-2 text-sm text-pfi-heading whitespace-nowrap">
                        {lead.kategori}
                      </span>
                    ) : (
                      <span className="text-sm text-pfi-heading">-</span>
                    )}
                  </div>

                  <div className="w-[150px] shrink-0 p-2.5 text-sm text-pfi-heading">
                    {lead.sumber ?? "-"}
                  </div>

                  <div className="w-[190px] shrink-0 p-2.5">
                    <StatusBadge status={lead.status} />
                  </div>

                  <div className="w-[116px] shrink-0 p-2.5 text-sm text-pfi-heading tabular-nums">
                    {lead.no_spaj ?? "-"}
                  </div>

                  <div className="w-[115px] shrink-0 p-2.5 text-sm text-pfi-heading tabular-nums">
                    {lead.no_polis ?? "-"}
                  </div>

                  <div className="w-[116px] shrink-0 p-2.5 text-sm text-pfi-heading tabular-nums">
                    {lead.tgl_inforce ?? "-"}
                  </div>

                  <div className="flex w-[58px] shrink-0 items-center justify-center">
                    <RowMenu lead={lead} onDuplicate={handleDuplicate} onDelete={setToDelete} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <Pagination
          shown={rows.length}
          total={filtered.length}
          page={currentPage}
          totalPages={totalPages}
          pendingSync={pendingSync}
          onChange={setPage}
        />
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Hapus lead ini?"
          description={
            <>
              <strong className="font-semibold text-pfi-heading">
                {[toDelete.nama_depan, toDelete.nama_tengah, toDelete.nama_belakang]
                  .filter(Boolean)
                  .join(" ")}
              </strong>{" "}
              ({toDelete.lead_code ?? "tanpa ID"}) akan dihapus dari daftar. Penghapusan
              ini ikut diantrekan untuk dikirim ke server saat sinkronisasi berjalan.
            </>
          }
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

/** Susun nomor halaman dengan elipsis saat halaman terlalu banyak. */
function pageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, "…", totalPages];
  if (page >= totalPages - 2) return [1, "…", totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page, "…", totalPages];
}

function Pagination({
  shown,
  total,
  page,
  totalPages,
  pendingSync,
  onChange,
}: {
  shown: number;
  total: number;
  page: number;
  totalPages: number;
  pendingSync: number;
  onChange: (page: number) => void;
}) {
  const controlClass =
    "grid size-7 place-items-center rounded-lg border border-pfi-page-border bg-white transition hover:bg-pfi-hairline disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-pfi-page">
          Showing {shown} of {total} data
        </p>
        {pendingSync > 0 && (
          <p className="text-xs text-pfi-subtle" data-testid="pending-sync">
            {pendingSync} perubahan menunggu sinkronisasi ke server
          </p>
        )}
      </div>

      <div className="flex items-center gap-[5px]">
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={page === 1}
          aria-label="Halaman pertama"
          className={controlClass}
        >
          <img src="/leads/page-first.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          aria-label="Halaman sebelumnya"
          className={controlClass}
        >
          <img src="/leads/page-prev.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>

        {pageList(page, totalPages).map((entry, index) =>
          entry === "…" ? (
            <span
              key={`gap-${index}`}
              className="grid size-7 place-items-center text-[13px] font-semibold text-pfi-heading"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onChange(entry)}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "grid size-7 place-items-center rounded-lg text-xs font-medium tracking-[0.06px] transition",
                entry === page
                  ? "bg-pfi-link text-white"
                  : "border border-pfi-page-border bg-white text-pfi-heading hover:bg-pfi-hairline"
              )}
            >
              {entry}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Halaman berikutnya"
          className={controlClass}
        >
          <img src="/leads/page-next.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
        <button
          type="button"
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Halaman terakhir"
          className={controlClass}
        >
          <img src="/leads/page-last.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
        </button>
      </div>
    </div>
  );
}
