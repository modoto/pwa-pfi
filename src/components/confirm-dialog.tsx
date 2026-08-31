"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog konfirmasi untuk aksi yang merusak.
 *
 * Belum ada desain khusus untuk dialog ini, jadi bentuknya mengikuti modal
 * "Pilih Bank Staff" yang sudah ada agar konsisten.
 *
 * Di-mount hanya saat terbuka, sehingga tidak perlu mereset state lewat efek.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Batalkan",
  tone = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
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

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[460px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-pfi-hairline px-5 py-5">
          <div className="flex items-start gap-3.5">
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full",
                tone === "danger" ? "bg-pfi-down-bg text-pfi-down-fg" : "bg-pfi-tint text-pfi-link"
              )}
            >
              <TriangleAlert className="size-5" aria-hidden />
            </span>
            <h2 id={titleId} className="pt-1.5 text-lg font-bold text-pfi-heading">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="px-5 py-5 text-sm text-pfi-muted">{description}</div>

        <footer className="flex items-center justify-end gap-3 border-t border-pfi-hairline px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className={cn(
              "rounded-[10px] px-6 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
              tone === "danger"
                ? "bg-pfi-down-fg hover:brightness-110"
                : "bg-pfi-orange hover:bg-pfi-orange-dark"
            )}
          >
            {busy ? "Memproses …" : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
