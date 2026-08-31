/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import type { Metadata } from "next";
import Link from "next/link";
import { LeadsTable } from "@/components/leads/leads-table";

export const metadata: Metadata = {
  title: "Leads",
  description: "Kelola dan pantau progres seluruh Lead.",
};

export default function LeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-5 border-b border-pfi-line px-3.5 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-xl/[24px] font-bold text-pfi-heading">Daftar Leads</h1>
          <p className="text-sm text-pfi-muted">Kelola dan pantau progres seluruh Lead.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <button
            type="button"
            className="flex items-center gap-5 rounded-[10px] border border-pfi-link bg-white px-3 py-3 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint"
          >
            <img src="/leads/export.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
            Export
          </button>

          <Link
            href="/leads/create"
            className="flex items-center gap-3 rounded-[10px] bg-pfi-orange p-3 text-sm font-medium text-white transition hover:bg-pfi-orange-dark"
          >
            <img src="/leads/plus.svg" alt="" aria-hidden className="size-4 max-w-none object-contain" />
            Tambah Lead
          </Link>
        </div>
      </header>

      <LeadsTable />
    </div>
  );
}
