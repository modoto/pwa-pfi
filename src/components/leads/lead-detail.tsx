"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, Mail, Pencil, Rocket, Star, User, UserCog } from "lucide-react";
import { ActivityList } from "@/components/leads/activity-list";
import { cn } from "@/lib/utils";
import { STATUS_TONE, type LeadStatus } from "@/lib/leads-data";
import {
  getLead,
  listAssignments,
  type LeadAssignmentRow,
  type LeadRow,
} from "@/lib/db/leads-repo";

const TONE_CLASS = {
  blue: "bg-status-blue-bg border-status-blue-border text-status-blue-fg",
  purple: "bg-status-purple-bg border-status-purple-border text-status-purple-fg",
  orange: "bg-status-orange-bg border-status-orange-border text-status-orange-fg",
  green: "bg-status-green-bg border-status-green-border text-status-green-fg",
} as const;

function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[60px] border px-2.5 py-1.5 text-sm font-medium whitespace-nowrap",
        TONE_CLASS[STATUS_TONE[status] ?? "blue"]
      )}
    >
      {status}
    </span>
  );
}

/** Nilai kosong ditampilkan sebagai strip, bukan dibiarkan hilang. */
function Value({ children }: { children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <p className="text-base text-pfi-heading">{empty ? "–" : children}</p>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-pfi-hairline pb-4">
      <p className="text-xs font-medium uppercase tracking-wide text-pfi-muted">{label}</p>
      <Value>{children}</Value>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof User;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-pfi-hairline bg-white shadow-card">
      <header className="flex items-center justify-between gap-3 border-b border-pfi-hairline p-4 sm:px-6">
        <div className="flex items-center gap-3.5">
          <Icon className="size-5 shrink-0 text-pfi-link" aria-hidden />
          <h2 className="text-base font-bold text-pfi-heading">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

function fullName(row: LeadRow) {
  return [row.nama_depan, row.nama_tengah, row.nama_belakang].filter(Boolean).join(" ");
}

/**
 * Ambil dua huruf awal dari nama lengkap, bukan dari kolomnya masing-masing —
 * nama lengkap kerap tersimpan seluruhnya di `nama_depan`.
 */
function initials(row: LeadRow) {
  return fullName(row)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** ISO (yyyy-mm-dd) → dd/mm/yyyy; nilai lain dibiarkan apa adanya. */
function formatDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function formatStamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function usia(tanggalLahir: string | null) {
  if (!tanggalLahir) return null;
  const lahir = new Date(tanggalLahir);
  if (Number.isNaN(lahir.getTime())) return null;

  const today = new Date();
  let umur = today.getFullYear() - lahir.getFullYear();
  const belum =
    today.getMonth() < lahir.getMonth() ||
    (today.getMonth() === lahir.getMonth() && today.getDate() < lahir.getDate());
  if (belum) umur -= 1;

  return umur >= 0 ? `${umur} tahun` : null;
}

const SKOR_CELLS = [
  { key: "skor_pekerjaan", label: "Pekerjaan" },
  { key: "skor_rumah", label: "Rumah" },
  { key: "skor_sekolah", label: "Sekolah" },
  { key: "skor_anak", label: "Anak" },
  { key: "skor_kendaraan", label: "Kendaraan" },
  { key: "skor_asuransi", label: "Asuransi" },
] as const;

export function LeadDetail({
  leadId,
  agentName,
}: {
  leadId: string;
  agentName: string | null;
}) {
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [assignments, setAssignments] = useState<LeadAssignmentRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"profil" | "aktivitas">("profil");

  const load = useCallback(async () => {
    try {
      const row = await getLead(leadId);
      if (!row) {
        setState("missing");
        return;
      }

      setLead(row);
      setAssignments(await listAssignments(leadId));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal membuka database lokal.");
      setState("error");
    }
  }, [leadId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void load();
  }, [load]);

  if (state === "loading") {
    return <p className="p-10 text-center text-sm text-pfi-muted">Memuat data lokal …</p>;
  }

  if (state === "error") {
    return <p className="p-10 text-center text-sm font-medium text-pfi-down-fg">{message}</p>;
  }

  if (state === "missing" || !lead) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-pfi-muted">Lead tidak ditemukan di database lokal.</p>
        <Link href="/leads" className="text-sm font-bold text-pfi-link hover:underline">
          Kembali ke Daftar Leads
        </Link>
      </div>
    );
  }

  const kategoriSumber = [lead.kategori, lead.sumber && `(${lead.sumber})`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Bar aksi ---------- */}
      <div className="-mx-4 flex flex-col gap-3 border-b border-pfi-hairline bg-white px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/leads"
            aria-label="Kembali ke daftar leads"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-pfi-line bg-white text-pfi-heading transition hover:bg-pfi-hairline"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="truncate text-xl font-bold text-pfi-heading">Detail Lead</h1>
        </div>

        {/* TODO: ketiga aksi ini menunggu desain modal dan endpoint-nya. */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-3 rounded-[10px] border border-pfi-link bg-white px-4 py-2.5 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
          >
            <Mail className="size-4" aria-hidden />
            Kirim Pesan
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-[10px] border border-pfi-link bg-white px-4 py-2.5 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
          >
            <Pencil className="size-4" aria-hidden />
            Ubah Status
          </button>
          <button
            type="button"
            className="flex items-center gap-3 rounded-[10px] bg-pfi-orange px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark"
          >
            <Rocket className="size-4" aria-hidden />
            Mulai Proses
          </button>
        </div>
      </div>

      {/* ---------- Identitas ---------- */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-pfi-hairline bg-white p-4 shadow-card sm:p-5">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-pfi-avatar-bg text-lg font-semibold text-pfi-avatar-fg">
            {initials(lead)}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="truncate text-xl font-bold text-pfi-heading">{fullName(lead)}</p>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-pfi-muted">
              <span>{lead.lead_code ?? "–"}</span>
              <span aria-hidden className="size-1 rounded-full bg-pfi-subtle" />
              <span>{lead.nomor_telepon ?? "–"}</span>
              {kategoriSumber && (
                <>
                  <span aria-hidden className="size-1 rounded-full bg-pfi-subtle" />
                  <span>{kategoriSumber}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <StatusBadge status={lead.status} />
      </section>

      {/* ---------- Tab ---------- */}
      <div className="grid grid-cols-2 gap-3 rounded-[14px] border border-pfi-hairline bg-white p-2.5 shadow-card">
        {(
          [
            ["profil", "Profil Lead"],
            ["aktivitas", "Aktivitas Lead"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-pressed={tab === key}
            className={cn(
              "rounded-[10px] px-4 py-3 text-base font-medium transition",
              tab === key
                ? "bg-pfi-link text-white"
                : "bg-white text-pfi-heading hover:bg-pfi-hairline"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "aktivitas" ? (
        <ActivityList
          leadId={lead.id}
          leadName={fullName(lead)}
          leadCode={lead.lead_code}
          agentName={agentName}
        />
      ) : (
        <>
          <Card title="Informasi Lead" icon={User}>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Nama Depan">{lead.nama_depan}</Field>
              <Field label="Nama Tengah">{lead.nama_tengah}</Field>
              <Field label="Nama Belakang">{lead.nama_belakang}</Field>

              <Field label="ID Lead">{lead.lead_code}</Field>
              <Field label="Jenis Kelamin">{lead.jenis_kelamin}</Field>
              <Field label="Tanggal Lahir">{formatDate(lead.tanggal_lahir)}</Field>

              <Field label="Usia">{usia(lead.tanggal_lahir)}</Field>
              <Field label="Nomor Telepon">{lead.nomor_telepon}</Field>
              <Field label="Alamat Email">{lead.alamat_email}</Field>

              <Field label="CIF">{lead.cif}</Field>
              <Field label="Kode Cabang">{lead.kode_cabang}</Field>
              <Field label="Kategori">{lead.kategori}</Field>

              <Field label="Sumber">{lead.sumber}</Field>
              <Field label="Nama Bank Staff">{lead.bank_staff_nama}</Field>
              <Field label="Tenaga Pemasar">{lead.tenaga_pemasar}</Field>

              <Field label="RSM">{lead.rsm}</Field>
              <Field label="Status Lead">
                <StatusBadge status={lead.status} />
              </Field>
              <Field label="Keterangan">{lead.keterangan}</Field>
            </div>
          </Card>

          <Card title="Skor Lead" icon={Star}>
            <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-pfi-hairline sm:grid-cols-3 lg:grid-cols-6">
              {SKOR_CELLS.map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 border-b border-r border-pfi-hairline p-3 last:border-r-0"
                >
                  <span className="text-xs font-medium uppercase text-pfi-muted">{label}</span>
                  <span className="text-base font-bold text-pfi-heading tabular-nums">
                    {lead[key] ?? "–"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {(
                [
                  ["Skor Prediksi", lead.skor_prediksi],
                  ["Skor Akhir", lead.skor_akhir],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-[10px] border border-pfi-hairline bg-pfi-tint p-3"
                >
                  <span className="text-xs font-medium uppercase text-pfi-link">{label}</span>
                  <span className="text-base font-bold text-pfi-link tabular-nums">
                    {value ?? "–"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[10px] border border-pfi-hairline bg-pfi-bg p-4">
              <p className="text-xs font-medium uppercase text-pfi-muted">Remark:</p>
              <p className="mt-2 text-sm text-pfi-heading">{lead.remark ?? "–"}</p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-pfi-muted">
              <span>
                Dibuat Oleh : {lead.created_by ?? "–"}, {formatStamp(lead.created_at) ?? "–"}
              </span>
              <span className="hidden h-4 w-px bg-pfi-line sm:block" aria-hidden />
              <span>
                Diubah Oleh : {lead.updated_by ?? "–"}, {formatStamp(lead.updated_at) ?? "–"}
              </span>
            </div>
          </Card>

          <Card
            title="Riwayat Assignment"
            icon={UserCog}
            action={
              <span className="rounded-full bg-pfi-hairline px-3 py-1.5 text-xs font-medium text-pfi-muted">
                {assignments.length} riwayat
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="bg-pfi-thead">
                    {[
                      "Tenaga Pemasar Sebelumnya",
                      "Tenaga Pemasar Sekarang",
                      "RSM",
                      "Tanggal",
                      "Remark",
                    ].map((head) => (
                      <th
                        key={head}
                        className="px-4 py-4 text-sm font-semibold uppercase text-pfi-heading"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-pfi-muted">
                        Belum ada riwayat assignment.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((row) => (
                      <tr key={row.id} className="border-b border-pfi-hairline">
                        <td className="px-4 py-4 text-sm text-pfi-heading">
                          {row.tenaga_pemasar_sebelumnya ?? "–"}
                        </td>
                        <td className="px-4 py-4 text-sm text-pfi-heading">
                          {row.tenaga_pemasar_sekarang ?? "–"}
                        </td>
                        <td className="px-4 py-4 text-sm text-pfi-heading">{row.rsm ?? "–"}</td>
                        <td className="px-4 py-4 text-sm text-pfi-heading">{row.tanggal ?? "–"}</td>
                        <td className="px-4 py-4 text-sm text-pfi-heading">{row.remark ?? "–"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
