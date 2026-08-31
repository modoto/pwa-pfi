"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Crosshair, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATATAN_AKTIVITAS,
  JENIS_AKTIVITAS,
  createActivity,
  updateActivity,
  type ActivityRow,
} from "@/lib/db/activities-repo";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const inputClass =
  "w-full rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 text-sm text-pfi-heading " +
  "outline-none transition placeholder:text-pfi-search " +
  "focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15";

const selectClass = cn(
  inputClass,
  "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12"
);

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-sm text-pfi-heading">
        {label}
        {required && <span className="text-pfi-down-fg">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-pfi-down-fg">{error}</p>}
    </div>
  );
}

/**
 * Modal Buat / Lengkapi Aktivitas.
 *
 * Di-mount hanya saat terbuka sehingga nilai awalnya cukup dibaca sekali.
 */
export function ActivityModal({
  leadId,
  leadName,
  leadCode,
  agentName,
  activity,
  onClose,
  onSaved,
}: {
  leadId: string;
  leadName: string;
  leadCode: string | null;
  agentName: string | null;
  activity?: ActivityRow;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const editing = Boolean(activity);

  const [jenis, setJenis] = useState(activity?.jenis_aktivitas ?? "");
  const [keterangan, setKeterangan] = useState(activity?.keterangan ?? "");
  const [tanggal, setTanggal] = useState(activity?.tanggal ?? "");
  const [waktu, setWaktu] = useState(activity?.waktu ?? "");
  const [lokasiRencana, setLokasiRencana] = useState(activity?.lokasi_rencana ?? "");
  const [lokasiAktual, setLokasiAktual] = useState(activity?.lokasi_aktual ?? "");
  const [catatan, setCatatan] = useState(activity?.catatan ?? "");
  const [catatanTambahan, setCatatanTambahan] = useState(activity?.catatan_tambahan ?? "");

  const [gambar, setGambar] = useState<File | null>(null);
  const [gambarError, setGambarError] = useState("");
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fileInput = useRef<HTMLInputElement>(null);
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

  function pickImage(file: File | null) {
    setGambarError("");
    if (!file) {
      setGambar(null);
      return;
    }

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setGambarError("Format harus .png, .jpg, atau .jpeg.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setGambarError("Ukuran gambar melebihi 2MB.");
      return;
    }

    setGambar(file);
  }

  function ambilLokasi() {
    if (!navigator.geolocation) {
      setLokasiAktual("");
      setErrors((prev) => ({ ...prev, lokasiAktual: "Perangkat tidak mendukung GPS." }));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Tanpa layanan geocoding, yang bisa disimpan hanya koordinat.
        setLokasiAktual(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setErrors((prev) => ({ ...prev, lokasiAktual: "" }));
        setLocating(false);
      },
      (error) => {
        setErrors((prev) => ({ ...prev, lokasiAktual: `Gagal mengambil lokasi: ${error.message}` }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleSave() {
    const found: Record<string, string> = {};
    if (!jenis) found.jenis = "Jenis aktivitas wajib dipilih.";
    if (!tanggal) found.tanggal = "Tanggal wajib diisi.";
    if (!lokasiRencana.trim()) found.lokasiRencana = "Lokasi rencana wajib diisi.";

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setSaveError("");

    try {
      const payload = {
        jenis_aktivitas: jenis,
        keterangan: keterangan.trim() || null,
        tanggal,
        waktu: waktu || null,
        lokasi_rencana: lokasiRencana.trim(),
        lokasi_aktual: lokasiAktual.trim() || null,
        catatan: catatan || null,
        catatan_tambahan: catatanTambahan.trim() || null,
        ...(gambar
          ? {
              gambar: new Uint8Array(await gambar.arrayBuffer()),
              gambar_tipe: gambar.type,
              gambar_nama: gambar.name,
            }
          : {}),
      };

      if (activity) {
        await updateActivity(activity.id, { ...payload, updated_by: agentName });
      } else {
        await createActivity(leadId, {
          ...payload,
          status: "Terjadwal",
          created_by: agentName,
          updated_by: agentName,
        });
      }

      await onSaved();
      onClose();
    } catch (error) {
      setSaving(false);
      setSaveError(
        error instanceof Error ? error.message : "Gagal menyimpan ke database lokal."
      );
    }
  }

  const gambarLabel = gambar?.name ?? activity?.gambar_nama ?? null;

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
        className="flex max-h-[88dvh] w-full max-w-[1034px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-pfi-hairline px-5 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-xl font-bold text-pfi-heading">
              {editing ? "Lengkapi Data Aktivitas" : "Buat Aktivitas"}
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

          <Field label="Jenis Aktivitas" required error={errors.jenis}>
            <select
              value={jenis}
              onChange={(event) => setJenis(event.target.value)}
              className={cn(selectClass, errors.jenis && "border-pfi-down-fg")}
            >
              <option value="">Pilih Jenis Aktivitas</option>
              {JENIS_AKTIVITAS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Keterangan">
            <textarea
              value={keterangan}
              onChange={(event) => setKeterangan(event.target.value)}
              rows={3}
              placeholder="Masukan keterangan"
              className={cn(inputClass, "resize-y")}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Tanggal" required error={errors.tanggal}>
              <input
                type="date"
                value={tanggal}
                onChange={(event) => setTanggal(event.target.value)}
                aria-label="Tanggal aktivitas"
                className={cn(inputClass, errors.tanggal && "border-pfi-down-fg")}
              />
            </Field>

            <Field label="Waktu">
              <input
                type="time"
                value={waktu}
                onChange={(event) => setWaktu(event.target.value)}
                aria-label="Waktu aktivitas"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Lokasi Rencana" required error={errors.lokasiRencana}>
            <input
              value={lokasiRencana}
              onChange={(event) => setLokasiRencana(event.target.value)}
              placeholder="Masukan lokasi"
              className={cn(inputClass, errors.lokasiRencana && "border-pfi-down-fg")}
            />
          </Field>

          <Field label="Lokasi Aktual" error={errors.lokasiAktual}>
            {lokasiAktual ? (
              <div className="flex items-center justify-between gap-3 rounded-[10px] border border-pfi-line bg-pfi-chip-bg px-3.5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm text-pfi-heading">
                  {lokasiAktual}
                </span>
                <button
                  type="button"
                  onClick={() => setLokasiAktual("")}
                  className="shrink-0 text-sm font-medium text-pfi-link hover:underline"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={ambilLokasi}
                disabled={locating}
                className="flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-pfi-link bg-white px-4 py-3 text-sm font-medium text-pfi-link transition hover:bg-pfi-tint disabled:opacity-60"
              >
                <Crosshair className="size-5" aria-hidden />
                {locating ? "Mengambil lokasi …" : "Ambil Lokasi"}
              </button>
            )}
          </Field>

          <Field label="Catatan">
            <select
              value={catatan}
              onChange={(event) => setCatatan(event.target.value)}
              className={selectClass}
            >
              <option value="">Pilih Catatan Aktivitas</option>
              {CATATAN_AKTIVITAS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Catatan Tambahan">
            <textarea
              value={catatanTambahan}
              onChange={(event) => setCatatanTambahan(event.target.value)}
              rows={3}
              placeholder="Masukan catatan tambahan"
              className={cn(inputClass, "resize-y")}
            />
          </Field>

          <Field label="Gambar" error={gambarError}>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex flex-col items-center gap-2 rounded-[10px] border border-dashed border-pfi-line bg-pfi-bg px-4 py-8 transition hover:border-pfi-link"
            >
              <span className="grid size-10 place-items-center rounded-full bg-pfi-tint text-pfi-link">
                <UploadCloud className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-bold text-pfi-heading">
                {gambarLabel ?? "Klik untuk unggah gambar"}
              </span>
              <span className="text-xs text-pfi-subtle">
                Format yang didukung: .png, .jpg, .jpeg. Maksimal 2MB.
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(event) => pickImage(event.target.files?.[0] ?? null)}
            />
          </Field>
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
