"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronLeft,
  RefreshCw,
  ScanLine,
  Star,
  User,
  UserRoundPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BankStaffModal } from "@/components/leads/bank-staff-modal";
import { createLead, updateLead, type LeadInput, type LeadRow } from "@/lib/db/leads-repo";
import { LEAD_CATEGORIES } from "@/lib/leads-data";
import {
  KODE_CABANG,
  SKOR_FIELDS,
  SUMBER_LEAD,
  hitungSkorPrediksi,
  hitungUsia,
  type BankStaff,
  type SkorKey,
} from "@/lib/lead-form-data";

const inputClass =
  "w-full rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 text-sm text-pfi-heading " +
  "outline-none transition placeholder:text-pfi-search " +
  "focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15";

const readonlyClass =
  "w-full rounded-[10px] border border-pfi-line bg-pfi-hairline px-3.5 py-3 text-sm text-pfi-heading";

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <label className="text-sm text-pfi-heading">
        {label}
        {required && <span className="text-pfi-down-fg">*</span>}
      </label>
      {children}
      {error && <p className="text-xs font-medium text-pfi-down-fg">{error}</p>}
    </div>
  );
}

function CardSection({
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

type Errors = Record<string, string>;

const text = (value: string | null | undefined) => value ?? "";
const num = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

/**
 * Dipakai dua kali: halaman Tambah Lead, dan halaman Edit Lead.
 * Saat `lead` diisi, form berjalan dalam mode ubah — desain khusus untuk edit
 * belum ada, jadi tata letaknya sengaja sama persis.
 */
export function LeadForm({ lead }: { lead?: LeadRow }) {
  const editing = Boolean(lead);

  const [namaDepan, setNamaDepan] = useState(text(lead?.nama_depan));
  const [namaTengah, setNamaTengah] = useState(text(lead?.nama_tengah));
  const [namaBelakang, setNamaBelakang] = useState(text(lead?.nama_belakang));
  const [jenisKelamin, setJenisKelamin] = useState(text(lead?.jenis_kelamin));
  const [tanggalLahir, setTanggalLahir] = useState(text(lead?.tanggal_lahir));
  const [nomorTelepon, setNomorTelepon] = useState(text(lead?.nomor_telepon));
  const [email, setEmail] = useState(text(lead?.alamat_email));
  const [cif, setCif] = useState(text(lead?.cif));
  const [kodeCabang, setKodeCabang] = useState(text(lead?.kode_cabang));
  const [kategori, setKategori] = useState(text(lead?.kategori));
  const [sumber, setSumber] = useState(text(lead?.sumber));
  const [bankStaff, setBankStaff] = useState<BankStaff | null>(
    lead?.bank_staff_nip
      ? { code: lead.bank_staff_nip, name: text(lead.bank_staff_nama) }
      : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const [skor, setSkor] = useState<Record<SkorKey, string>>({
    pekerjaan: num(lead?.skor_pekerjaan),
    rumah: num(lead?.skor_rumah),
    sekolah: num(lead?.skor_sekolah),
    anak: num(lead?.skor_anak),
    kendaraan: num(lead?.skor_kendaraan),
    asuransi: num(lead?.skor_asuransi),
  });
  const [skorAkhir, setSkorAkhir] = useState(num(lead?.skor_akhir));
  const [remark, setRemark] = useState(text(lead?.remark));

  const dateInput = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const cancelHref = lead ? `/leads/details/${lead.id}` : "/leads";

  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState("");

  // Usia dan skor prediksi selalu ikut isian lain — di desain keduanya memang
  // tidak bisa diketik langsung.
  const usia = useMemo(() => hitungUsia(tanggalLahir), [tanggalLahir]);
  const skorPrediksi = useMemo(() => hitungSkorPrediksi(skor), [skor]);

  function validate(): Errors {
    const next: Errors = {};

    if (!namaDepan.trim()) next.namaDepan = "Nama depan wajib diisi.";
    if (!jenisKelamin) next.jenisKelamin = "Pilih jenis kelamin.";
    if (!tanggalLahir) next.tanggalLahir = "Tanggal lahir wajib diisi.";
    if (!nomorTelepon.trim()) next.nomorTelepon = "Nomor telepon wajib diisi.";
    else if (!/^[0-9+\-\s]{8,20}$/.test(nomorTelepon.trim()))
      next.nomorTelepon = "Format nomor telepon tidak valid.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = "Format email tidak valid.";
    if (!cif.trim()) next.cif = "CIF wajib diisi.";
    if (!kodeCabang) next.kodeCabang = "Pilih kode cabang.";
    if (!kategori) next.kategori = "Pilih kategori.";
    if (!sumber) next.sumber = "Pilih sumber.";
    if (!bankStaff) next.bankStaff = "Pilih nama bank staff.";

    for (const { key, label } of SKOR_FIELDS) {
      const value = skor[key];
      if (!value.trim()) next[key] = `${label} wajib diisi.`;
      else if (Number.isNaN(Number.parseFloat(value))) next[key] = "Harus berupa angka.";
    }

    if (!skorAkhir.trim()) next.skorAkhir = "Skor akhir wajib diisi.";
    else if (Number.isNaN(Number.parseFloat(skorAkhir))) next.skorAkhir = "Harus berupa angka.";
    if (!remark.trim()) next.remark = "Remark wajib diisi.";

    return next;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    if (Object.keys(found).length > 0) {
      setNotice("");
      document.querySelector("[data-error='true']")?.scrollIntoView({ block: "center" });
      return;
    }

    setSaving(true);
    try {
      // Disimpan ke SQLite lokal dan diantrekan di sync_operations.
      // Pengirimannya menunggu endpoint lead tersedia di API.
      const payload: LeadInput = {
        nama_depan: namaDepan.trim(),
        nama_tengah: namaTengah.trim() || null,
        nama_belakang: namaBelakang.trim() || null,
        jenis_kelamin: jenisKelamin,
        tanggal_lahir: tanggalLahir,
        nomor_telepon: nomorTelepon.trim(),
        alamat_email: email.trim() || null,
        cif: cif.trim(),
        kode_cabang: kodeCabang,
        kategori,
        sumber,
        bank_staff_nip: bankStaff?.code ?? null,
        bank_staff_nama: bankStaff?.name ?? null,
        skor_pekerjaan: Number.parseFloat(skor.pekerjaan),
        skor_rumah: Number.parseFloat(skor.rumah),
        skor_sekolah: Number.parseFloat(skor.sekolah),
        skor_anak: Number.parseFloat(skor.anak),
        skor_kendaraan: Number.parseFloat(skor.kendaraan),
        skor_asuransi: Number.parseFloat(skor.asuransi),
        skor_prediksi: skorPrediksi ? Number.parseFloat(skorPrediksi) : null,
        skor_akhir: Number.parseFloat(skorAkhir),
        remark: remark.trim(),
      };

      if (lead) {
        // Status sengaja tidak ikut diubah di sini — itu urusan aksi
        // "Ubah Status" di halaman detail.
        await updateLead(lead.id, payload);
        router.push(`/leads/details/${lead.id}`);
      } else {
        await createLead({ ...payload, status: "New" });
        router.push("/leads");
      }
    } catch (error) {
      setSaving(false);
      setNotice(
        error instanceof Error
          ? `Gagal menyimpan ke database lokal: ${error.message}`
          : "Gagal menyimpan ke database lokal."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* ---------- Bar aksi ---------- */}
      {/* Di HP judul dan tombol dipisah dua baris — satu baris membuat judul terpotong. */}
      <div className="-mx-4 flex flex-col gap-3 border-b border-pfi-hairline bg-white px-4 py-3 sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={cancelHref}
            aria-label="Kembali"
            className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-pfi-line bg-white text-pfi-heading transition hover:bg-pfi-hairline"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="truncate text-xl font-bold text-pfi-heading">
            {editing ? "Edit Lead" : "Tambah Lead"}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={cancelHref}
            className="flex-1 rounded-[10px] border border-pfi-line bg-white px-5 py-2.5 text-center text-sm font-medium text-pfi-heading transition hover:bg-pfi-hairline sm:flex-none"
          >
            Batalkan
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-[10px] bg-pfi-orange px-6 py-2.5 text-sm font-medium text-white transition hover:bg-pfi-orange-dark disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
          >
            {saving ? "Menyimpan …" : editing ? "Simpan Perubahan" : "Simpan"}
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-[10px] border border-pfi-link/30 bg-pfi-tint px-4 py-3 text-sm font-medium text-pfi-link">
          {notice}
        </p>
      )}

      {/* ---------- Informasi Lead ---------- */}
      <CardSection
        title="Informasi Lead"
        icon={User}
        action={
          <button
            type="button"
            // TODO: sambungkan ke layanan OCR KTP.
            onClick={() => setNotice("Fitur OCR KTP belum tersedia.")}
            className="flex shrink-0 items-center gap-2.5 rounded-[10px] bg-pfi-link px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
          >
            <ScanLine className="size-4" aria-hidden />
            OCR KTP
          </button>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nama Depan" required error={errors.namaDepan}>
            <input
              value={namaDepan}
              onChange={(e) => setNamaDepan(e.target.value)}
              placeholder="Masukan nama depan"
              data-error={Boolean(errors.namaDepan)}
              className={cn(inputClass, errors.namaDepan && "border-pfi-down-fg")}
            />
          </Field>

          <Field label="Nama Tengah">
            <input
              value={namaTengah}
              onChange={(e) => setNamaTengah(e.target.value)}
              placeholder="Masukan nama tengah"
              className={inputClass}
            />
          </Field>

          <Field label="Nama Belakang">
            <input
              value={namaBelakang}
              onChange={(e) => setNamaBelakang(e.target.value)}
              placeholder="Masukan nama belakang"
              className={inputClass}
            />
          </Field>

          <Field label="Jenis Kelamin" required error={errors.jenisKelamin}>
            <div
              className="flex items-center gap-6 py-3"
              data-error={Boolean(errors.jenisKelamin)}
            >
              {["Laki-Laki", "Perempuan"].map((pilihan) => (
                <label key={pilihan} className="flex cursor-pointer items-center gap-2.5 text-sm text-pfi-heading">
                  <span className="relative grid size-5 place-items-center">
                    <input
                      type="radio"
                      name="jenisKelamin"
                      value={pilihan}
                      checked={jenisKelamin === pilihan}
                      onChange={(e) => setJenisKelamin(e.target.value)}
                      className="peer size-5 appearance-none rounded-full border-2 border-pfi-line transition checked:border-pfi-radio focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pfi-radio"
                    />
                    <span className="pointer-events-none absolute size-2.5 rounded-full bg-pfi-radio opacity-0 transition peer-checked:opacity-100" />
                  </span>
                  {pilihan}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Tanggal Lahir" required error={errors.tanggalLahir}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 transition",
                "focus-within:border-pfi-link focus-within:ring-2 focus-within:ring-pfi-link/15",
                errors.tanggalLahir && "border-pfi-down-fg"
              )}
              data-error={Boolean(errors.tanggalLahir)}
            >
              {/* Ikon bawaan browser disembunyikan agar hanya ikon desain yang tampil. */}
              <button
                type="button"
                onClick={() => dateInput.current?.showPicker?.()}
                aria-label="Buka pemilih tanggal"
                className="shrink-0 text-pfi-link"
              >
                <Calendar className="size-5" aria-hidden />
              </button>
              <input
                ref={dateInput}
                type="date"
                value={tanggalLahir}
                onChange={(e) => setTanggalLahir(e.target.value)}
                aria-label="Tanggal lahir"
                className="min-w-0 flex-1 bg-transparent text-sm text-pfi-heading outline-none [&::-webkit-calendar-picker-indicator]:hidden"
              />
            </div>
          </Field>

          <Field label="Usia (tahun)" required>
            {/* Dihitung dari tanggal lahir — sesuai desain, tidak bisa diketik. */}
            <input value={usia} readOnly aria-readonly placeholder="-" className={readonlyClass} />
          </Field>

          <Field label="Nomor Telepon" required error={errors.nomorTelepon}>
            <input
              value={nomorTelepon}
              onChange={(e) => setNomorTelepon(e.target.value)}
              inputMode="tel"
              placeholder="Masukan nomor telepon"
              data-error={Boolean(errors.nomorTelepon)}
              className={cn(inputClass, errors.nomorTelepon && "border-pfi-down-fg")}
            />
          </Field>

          <Field label="Alamat Email" error={errors.email}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Masukan email lead"
              data-error={Boolean(errors.email)}
              className={cn(inputClass, errors.email && "border-pfi-down-fg")}
            />
          </Field>

          <Field label="CIF" required error={errors.cif}>
            <input
              value={cif}
              onChange={(e) => setCif(e.target.value)}
              inputMode="numeric"
              placeholder="Masukan CIF"
              data-error={Boolean(errors.cif)}
              className={cn(inputClass, errors.cif && "border-pfi-down-fg")}
            />
          </Field>

          <Field label="Kode Cabang" required error={errors.kodeCabang}>
            <select
              value={kodeCabang}
              onChange={(e) => setKodeCabang(e.target.value)}
              data-error={Boolean(errors.kodeCabang)}
              className={cn(inputClass, "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12", errors.kodeCabang && "border-pfi-down-fg")}
            >
              <option value="">Pilih kode cabang</option>
              {KODE_CABANG.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Kategori" required error={errors.kategori}>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              data-error={Boolean(errors.kategori)}
              className={cn(inputClass, "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12", errors.kategori && "border-pfi-down-fg")}
            >
              <option value="">Pilih kategori</option>
              {LEAD_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Sumber" required error={errors.sumber}>
            <select
              value={sumber}
              onChange={(e) => setSumber(e.target.value)}
              data-error={Boolean(errors.sumber)}
              className={cn(inputClass, "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12", errors.sumber && "border-pfi-down-fg")}
            >
              <option value="">Pilih sumber</option>
              {SUMBER_LEAD.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Nama Bank Staff" required error={errors.bankStaff} className="relative">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPickerOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPickerOpen(true);
                }
              }}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[10px] border border-pfi-line bg-pfi-chip-bg p-2.5 transition hover:border-pfi-link",
                errors.bankStaff && "border-pfi-down-fg"
              )}
              data-error={Boolean(errors.bankStaff)}
            >
              {bankStaff ? (
                <>
                  <span className="shrink-0 rounded-md bg-white px-2 py-1 text-sm text-pfi-heading">
                    {bankStaff.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-pfi-heading">
                    {bankStaff.name}
                  </span>
                </>
              ) : (
                <span className="min-w-0 flex-1 truncate py-1 text-sm text-pfi-search">
                  Pilih bank staff
                </span>
              )}

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                aria-expanded={pickerOpen}
                aria-label="Pilih bank staff"
                className="grid size-7 shrink-0 place-items-center rounded-md text-pfi-link transition hover:bg-white"
              >
                <UserRoundPlus className="size-5" aria-hidden />
              </button>
            </div>

          </Field>
        </div>
      </CardSection>

      {/* ---------- Skor Lead ---------- */}
      <CardSection title="Skor Lead" icon={Star}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SKOR_FIELDS.map(({ key, label }) => (
            <Field key={key} label={label} required error={errors[key]}>
              <input
                value={skor[key]}
                onChange={(e) => setSkor((prev) => ({ ...prev, [key]: e.target.value }))}
                inputMode="decimal"
                placeholder="0.0"
                data-error={Boolean(errors[key])}
                className={cn(inputClass, errors[key] && "border-pfi-down-fg")}
              />
            </Field>
          ))}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Field label="Skor Prediksi">
            {/* Rata-rata enam komponen di atas. */}
            <input
              value={skorPrediksi}
              readOnly
              aria-readonly
              placeholder="-"
              className={readonlyClass}
            />
          </Field>

          <Field label="Skor Akhir" required error={errors.skorAkhir}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-[10px] border-2 border-pfi-link bg-pfi-tint px-3.5 py-[10px]",
                errors.skorAkhir && "border-pfi-down-fg"
              )}
              data-error={Boolean(errors.skorAkhir)}
            >
              <button
                type="button"
                onClick={() => setSkorAkhir(skorPrediksi)}
                disabled={!skorPrediksi}
                aria-label="Samakan dengan skor prediksi"
                className="grid size-6 shrink-0 place-items-center rounded text-pfi-link transition hover:bg-white disabled:opacity-40"
              >
                <RefreshCw className="size-5" aria-hidden />
              </button>
              <input
                value={skorAkhir}
                onChange={(e) => setSkorAkhir(e.target.value)}
                inputMode="decimal"
                placeholder="0.0"
                aria-label="Skor akhir"
                className="min-w-0 flex-1 bg-transparent text-sm text-pfi-heading outline-none placeholder:text-pfi-search"
              />
            </div>
          </Field>
        </div>

        <div className="mt-6 border-t border-dashed border-pfi-line pt-5">
          <Field label="Remark" required error={errors.remark}>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={4}
              placeholder="Masukan remark skor …"
              data-error={Boolean(errors.remark)}
              className={cn(inputClass, "resize-y", errors.remark && "border-pfi-down-fg")}
            />
          </Field>
        </div>
      </CardSection>

      {pickerOpen && (
        <BankStaffModal
          selected={bankStaff}
          onClose={() => setPickerOpen(false)}
          onSelect={setBankStaff}
        />
      )}
    </form>
  );
}
