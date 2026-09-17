"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { JENIS_KELAMIN, STATUS_MEROKOK } from "@/lib/illustration-data";
import { hitungUsia } from "@/lib/lead-form-data";

/**
 * Pilihan dropdown dari tabel lokal `msfields`. `null` = master belum
 * ditarik; dropdown-nya lalu dikunci dengan keterangan, bukan diisi daftar
 * karangan.
 */
export type PersonOptions = {
  statusPerkawinan: string[] | null;
  pekerjaan: string[] | null;
  tujuanAsuransi: string[] | null;
};

/** `field_key` di `msfields` untuk tiap dropdown. */
export const PERSON_FIELD_KEYS = {
  statusPerkawinan: "marital_status",
  pekerjaan: "job",
  tujuanAsuransi: "purpose_of_insurance",
} as const;

export const inputClass =
  "w-full rounded-[10px] border border-pfi-line bg-white px-3.5 py-3 text-sm text-pfi-heading " +
  "outline-none transition placeholder:text-pfi-search " +
  "focus:border-pfi-link focus:ring-2 focus:ring-pfi-link/15";

const readonlyClass =
  "w-full rounded-[10px] border border-pfi-line bg-pfi-hairline px-3.5 py-3 text-sm text-pfi-heading";

export const selectClass = cn(
  inputClass,
  "appearance-none bg-[url('/leads/arrow-down.svg')] bg-[length:24px_24px] bg-[right_0.75rem_center] bg-no-repeat pr-12"
);

/** Field wajib pada Data Pemegang Polis dan Data Calon Tertanggung. */
export const PERSON_REQUIRED: { field: string; label: string }[] = [
  { field: "nama_depan", label: "Nama depan" },
  { field: "tanggal_lahir", label: "Tanggal lahir" },
  { field: "jenis_kelamin", label: "Jenis kelamin" },
  { field: "merokok", label: "Status merokok" },
  { field: "status_perkawinan", label: "Status perkawinan" },
  { field: "pekerjaan", label: "Pekerjaan" },
  { field: "tujuan_asuransi", label: "Tujuan membeli asuransi" },
];

export function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
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

/** Pilihan berbentuk lingkaran, dipakai Jenis Kelamin dan status merokok. */
function RadioRow({
  name,
  options,
  value,
  onPick,
  invalid,
}: {
  name: string;
  options: readonly string[];
  value: string;
  onPick: (option: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const dipilih = value === option;

        return (
          <label
            key={option}
            className={cn(
              "flex flex-1 cursor-pointer items-center gap-3 rounded-[10px] border bg-white px-4 py-3 transition",
              dipilih
                ? "border-pfi-link"
                : invalid
                  ? "border-pfi-down-fg/40 hover:bg-pfi-hairline"
                  : "border-pfi-line hover:bg-pfi-hairline"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={dipilih}
              onChange={() => onPick(option)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border-2",
                dipilih ? "border-pfi-link" : "border-pfi-line"
              )}
            >
              {dipilih && <span className="size-2.5 rounded-full bg-pfi-link" />}
            </span>
            <span className="text-sm text-pfi-heading">{option}</span>
          </label>
        );
      })}
    </div>
  );
}

/**
 * Sepuluh field data seseorang pada langkah pertama Sales Illustration.
 *
 * `prefix` membedakan pemiliknya: kosong untuk pemegang polis, `ct_` untuk
 * calon tertanggung — keduanya disimpan pada langkah yang sama.
 */
export function PersonForm({
  prefix,
  values,
  errors,
  onChange,
  onSave,
  onPick,
  options,
}: {
  prefix: string;
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (field: string, nilai: string) => void;
  onSave: (field: string) => void;
  onPick: (field: string, nilai: string) => void;
  options: PersonOptions;
}) {
  const key = (field: string) => `${prefix}${field}`;
  const value = (field: string) => values[key(field)] ?? "";
  const error = (field: string) => errors[key(field)];

  const teks = (field: string, label: string, required?: boolean) => (
    <Field label={label} required={required} error={error(field)}>
      <input
        value={value(field)}
        onChange={(event) => onChange(key(field), event.target.value)}
        onBlur={() => onSave(key(field))}
        className={cn(inputClass, error(field) && "border-pfi-down-fg")}
      />
    </Field>
  );

  const dropdown = (
    field: string,
    label: string,
    placeholder: string,
    pilihan: string[] | null
  ) => (
    <Field label={label} required error={error(field)}>
      <select
        value={value(field)}
        onChange={(event) => onPick(key(field), event.target.value)}
        disabled={pilihan === null}
        className={cn(selectClass, error(field) && "border-pfi-down-fg")}
      >
        <option value="">{pilihan === null ? "Master data belum ditarik" : placeholder}</option>
        {/* Nilai tersimpan yang tidak ada lagi di master tetap ditampilkan,
            supaya isian lama tidak diam-diam terbaca kosong. */}
        {value(field) && pilihan && !pilihan.includes(value(field)) && (
          <option value={value(field)}>{value(field)}</option>
        )}
        {(pilihan ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
      {/* Desain menulis "Nama Depan" tiga kali; di sini dipakai nama yang benar
          untuk tiap kolom. */}
      {teks("nama_depan", "Nama Depan", true)}
      {teks("nama_tengah", "Nama Tengah")}
      {teks("nama_belakang", "Nama Belakang")}

      {teks("tempat_lahir", "Tempat Lahir")}

      <Field label="Tanggal Lahir" required error={error("tanggal_lahir")}>
        <input
          type="date"
          value={value("tanggal_lahir")}
          aria-label="Tanggal lahir"
          onChange={(event) => onPick(key("tanggal_lahir"), event.target.value)}
          className={cn(inputClass, error("tanggal_lahir") && "border-pfi-down-fg")}
        />
      </Field>

      <Field label="Usia (tahun)" required>
        {/* Dihitung dari tanggal lahir, tidak disimpan terpisah. */}
        <input
          value={hitungUsia(value("tanggal_lahir"))}
          readOnly
          aria-label="Usia"
          className={readonlyClass}
        />
      </Field>

      <Field label="Jenis Kelamin" required error={error("jenis_kelamin")}>
        <RadioRow
          name={key("jenis_kelamin")}
          options={JENIS_KELAMIN}
          value={value("jenis_kelamin")}
          onPick={(option) => onPick(key("jenis_kelamin"), option)}
          invalid={Boolean(error("jenis_kelamin"))}
        />
      </Field>

      <Field label="Apakah Anda Merokok?" required error={error("merokok")}>
        <RadioRow
          name={key("merokok")}
          options={STATUS_MEROKOK}
          value={value("merokok")}
          onPick={(option) => onPick(key("merokok"), option)}
          invalid={Boolean(error("merokok"))}
        />
      </Field>

      {dropdown("status_perkawinan", "Status Perkawinan", "Pilih status", options.statusPerkawinan)}
      {dropdown("pekerjaan", "Pekerjaan", "Pilih pekerjaan", options.pekerjaan)}
      {dropdown("tujuan_asuransi", "Tujuan Membeli Asuransi", "Pilih tujuan", options.tujuanAsuransi)}
    </div>
  );
}
