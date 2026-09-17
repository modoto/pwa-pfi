"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_CHOICES, type LeadStatus } from "@/lib/leads-data";
import { updateLead } from "@/lib/db/leads-repo";
import { listStatusChanges } from "@/lib/db/master-repo";

const inputClass =
  "w-full rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 text-sm text-pfi-heading " +
  "outline-none transition placeholder:text-pfi-search " +
  "focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15";

const selectClass = cn(
  inputClass,
  "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12"
);

/**
 * Modal Ubah Status Lead.
 *
 * Statusnya disimpan langsung di kolom `leads.status`, keterangan terakhir di
 * `leads.keterangan_status` — belum ada tabel riwayat perubahan status.
 */
export function StatusModal({
  leadId,
  leadName,
  leadCode,
  currentStatus,
  agentName,
  onClose,
  onSaved,
}: {
  leadId: string;
  leadName: string;
  leadCode: string | null;
  currentStatus: LeadStatus;
  agentName: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  // Status saat ini sengaja tidak dijadikan nilai awal: desain membuka modal
  // dengan "Pilih status" supaya perubahannya selalu pilihan sadar.
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [keterangan, setKeterangan] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  /**
   * Pilihan status dari master `mobile_status_changes`
   * (GetDataStatusChangeMobile). Sebelum master ditarik dipakai daftar desain,
   * supaya modal tetap bisa dipakai di perangkat yang belum sinkron.
   */
  const [pilihan, setPilihan] = useState<readonly string[]>(LEAD_STATUS_CHOICES);

  const muatPilihan = useCallback(async () => {
    const dariMaster = await listStatusChanges();
    if (dariMaster && dariMaster.length > 0) setPilihan(dariMaster);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pemuatan awal dari SQLite
    void muatPilihan().catch(() => undefined);
  }, [muatPilihan]);

  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onClose, saving]);

  async function handleSave() {
    if (!status) {
      setError("Status wajib dipilih.");
      return;
    }

    setError("");
    setSaving(true);
    setSaveError("");

    try {
      await updateLead(leadId, {
        status,
        keterangan_status: keterangan.trim() || null,
        updated_by: agentName,
      });

      await onSaved();
      onClose();
    } catch (err) {
      setSaving(false);
      setSaveError(
        err instanceof Error ? err.message : "Gagal menyimpan ke database lokal."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[88dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-pfi-hairline px-5 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
              Ubah Status Lead
            </h2>
            <p className="truncate text-sm text-pfi-muted">
              {leadName}
              {leadCode ? ` · ${leadCode}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-pfi-muted transition hover:bg-pfi-hairline disabled:opacity-50"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 sm:px-6">
          {saveError && (
            <p className="rounded-[10px] border border-pfi-down-fg/30 bg-pfi-down-bg px-4 py-3 text-sm font-medium text-pfi-down-fg">
              {saveError}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <label htmlFor={`${titleId}-status`} className="text-sm text-pfi-heading">
              Status<span className="text-pfi-down-fg">*</span>
            </label>
            <select
              id={`${titleId}-status`}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as LeadStatus | "");
                setError("");
              }}
              className={cn(selectClass, error && "border-pfi-down-fg")}
            >
              <option value="">Pilih status</option>
              {pilihan.filter((option) => option !== currentStatus).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <p className="text-xs font-medium text-pfi-down-fg">{error}</p>}
          </div>

          <div className="flex flex-col gap-2.5">
            <label htmlFor={`${titleId}-keterangan`} className="text-sm text-pfi-heading">
              Keterangan
            </label>
            <textarea
              id={`${titleId}-keterangan`}
              value={keterangan}
              onChange={(event) => setKeterangan(event.target.value)}
              rows={4}
              placeholder="Masukan keterangan"
              className={cn(inputClass, "resize-y")}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-pfi-hairline px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline disabled:opacity-50"
          >
            Batalkan
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-[10px] bg-pfi-orange px-6 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Menyimpan …" : "Simpan"}
          </button>
        </footer>
      </div>
    </div>
  );
}
