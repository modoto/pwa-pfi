"use client";

/* eslint-disable @next/next/no-img-element -- SVG statis hasil ekspor Figma. */
import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BANK_STAFF, type BankStaff } from "@/lib/lead-form-data";

/**
 * Modal "Pilih Bank Staff".
 *
 * Pilihan baru diterapkan saat menekan Simpan — Batalkan, tombol silang, Esc,
 * dan klik latar semuanya menutup tanpa mengubah apa pun.
 *
 * Komponen ini di-mount hanya saat terbuka, sehingga state awalnya selalu ikut
 * pilihan yang tersimpan tanpa perlu direset lewat efek.
 */
export function BankStaffModal({
  selected,
  onClose,
  onSelect,
}: {
  selected: BankStaff | null;
  onClose: () => void;
  onSelect: (staff: BankStaff) => void;
}) {
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<string | null>(selected?.code ?? null);
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Kunci scroll halaman di belakang modal.
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const rows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return BANK_STAFF;

    return BANK_STAFF.filter(
      (staff) =>
        staff.name.toLowerCase().includes(keyword) || staff.code.toLowerCase().includes(keyword)
    );
  }, [query]);

  const handleSave = () => {
    const staff = BANK_STAFF.find((item) => item.code === draft);
    if (staff) onSelect(staff);
    onClose();
  };

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
        className="flex max-h-[85dvh] w-full max-w-[1034px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-pfi-hairline px-5 py-5 sm:px-6">
          <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
            Pilih Bank Staff
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="grid size-9 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-5 sm:px-6">
          <div className="flex items-center gap-3 rounded-[10px] border border-pfi-line bg-white p-3">
            <img
              src="/leads/search.svg"
              alt=""
              aria-hidden
              className="size-5 max-w-none object-contain shrink-0"
            />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari NIP atau nama staff …"
              aria-label="Cari bank staff"
              className="min-w-0 flex-1 bg-transparent text-sm text-pfi-heading outline-none placeholder:text-pfi-search"
            />
          </div>

          {/* Tanpa lebar minimum: di HP kolom radio harus tetap terlihat,
              kalau tidak pengguna wajib menggeser tabel untuk memilih. */}
          <div className="mt-5">
            <table className="w-full table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-pfi-thead">
                  <th className="w-[42px] px-2 py-4 text-sm font-semibold uppercase text-pfi-heading sm:w-[70px] sm:px-4">
                    No
                  </th>
                  <th className="w-[88px] px-2 py-4 text-sm font-semibold uppercase text-pfi-heading sm:w-[220px] sm:px-4">
                    NIP
                  </th>
                  <th className="px-2 py-4 text-sm font-semibold uppercase text-pfi-heading sm:px-4">
                    Nama Staff
                  </th>
                  <th className="w-[46px] px-2 py-4 sm:w-[70px] sm:px-4">
                    <span className="sr-only">Pilih</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-10 sm:px-4 text-center text-sm text-pfi-muted">
                      Tidak ada staff yang cocok dengan pencarian Anda.
                    </td>
                  </tr>
                ) : (
                  rows.map((staff, index) => {
                    const checked = draft === staff.code;
                    return (
                      <tr
                        key={staff.code}
                        onClick={() => setDraft(staff.code)}
                        className={cn(
                          "cursor-pointer border-b border-pfi-hairline transition",
                          checked ? "bg-pfi-tint/60" : "hover:bg-pfi-bg"
                        )}
                      >
                        <td className="px-2 py-4 text-sm text-pfi-heading tabular-nums sm:px-4">
                          {index + 1}
                        </td>
                        <td className="px-2 py-4 text-sm text-pfi-heading sm:px-4">{staff.code}</td>
                        <td className="px-2 py-4 text-sm text-pfi-heading sm:px-4">{staff.name}</td>
                        <td className="px-2 py-4 sm:px-4">
                          <span className="relative grid size-5 place-items-center">
                            <input
                              type="radio"
                              name="bankStaff"
                              value={staff.code}
                              checked={checked}
                              onChange={() => setDraft(staff.code)}
                              aria-label={`${staff.code} ${staff.name}`}
                              className="peer size-5 appearance-none rounded-full border-2 border-pfi-line transition checked:border-pfi-radio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pfi-radio"
                            />
                            <span className="pointer-events-none absolute size-2.5 rounded-full bg-pfi-radio opacity-0 transition peer-checked:opacity-100" />
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
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
            onClick={handleSave}
            disabled={!draft}
            className="rounded-[10px] bg-pfi-orange px-6 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Simpan
          </button>
        </footer>
      </div>
    </div>
  );
}
