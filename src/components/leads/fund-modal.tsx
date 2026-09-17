"use client";

import { useEffect, useId, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterFund } from "@/lib/db/master-repo";

/**
 * Modal "Tambah Fund": pilih dana mana saja yang dipakai ilustrasi ini.
 * Pilihannya dari tabel lokal `funds`; yang dipilih dikenali lewat kode dana.
 */
export function FundModal({
  funds,
  selected,
  onSave,
  onClose,
}: {
  funds: MasterFund[];
  /** Kode dana yang sedang dipakai. */
  selected: string[];
  onSave: (codes: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  const titleId = useId();

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

  function toggle(fund: string) {
    setPicked((prev) =>
      prev.includes(fund) ? prev.filter((item) => item !== fund) : [...prev, fund]
    );
  }

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
        className="flex max-h-[88dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pfi-hairline px-5 py-5 sm:px-6">
          <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
            Tambah Fund
          </h2>
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
          {funds.map((master) => {
            const fund = master.fund_code ?? master.id;
            const dipilih = picked.includes(fund);

            return (
              <label
                key={fund}
                className={cn(
                  "flex cursor-pointer items-center gap-4 rounded-[10px] border px-4 py-3.5 transition",
                  dipilih
                    ? "border-pfi-link/60 bg-pfi-tint-alt"
                    : "border-pfi-hairline bg-white hover:bg-pfi-hairline"
                )}
              >
                <input
                  type="checkbox"
                  checked={dipilih}
                  onChange={() => toggle(fund)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-[6px] border-2 transition",
                    dipilih ? "border-pfi-link bg-pfi-link text-white" : "border-pfi-line bg-white"
                  )}
                >
                  {dipilih && <Check className="size-4" strokeWidth={3} />}
                </span>
                <span
                  className={cn(
                    "text-base",
                    dipilih ? "font-medium text-pfi-link" : "text-pfi-heading"
                  )}
                >
                  {master.fund_name ?? fund}
                </span>
              </label>
            );
          })}
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-pfi-hairline px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline"
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={() => onSave(picked)}
            className="rounded-[10px] bg-pfi-orange px-6 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark"
          >
            Simpan
          </button>
        </footer>
      </div>
    </div>
  );
}
