import type { Metadata } from "next";
import { cn, LEBAR_HALAMAN } from "@/lib/utils";

export const metadata: Metadata = { title: "Kalender" };

/** Placeholder — halaman ini menyusul setelah desain & API-nya tersedia. */
export default function Page() {
  return (
    <div className={cn(LEBAR_HALAMAN, "grid min-h-[50vh] place-items-center rounded-[14px] border border-pfi-hairline bg-white p-10 text-center shadow-card")}>
      <div className="flex flex-col gap-2">
        <h1 className="text-lg font-bold text-pfi-heading">Kalender</h1>
        <p className="text-sm text-pfi-muted">Halaman ini sedang disiapkan.</p>
      </div>
    </div>
  );
}
